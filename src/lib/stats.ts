import { db, schema } from "@/db";
import { eq, inArray, asc, desc } from "drizzle-orm";
import { cache } from "react";

export type Team = typeof schema.teams.$inferSelect;
export type Player = typeof schema.players.$inferSelect;
export type Match = typeof schema.matches.$inferSelect;
export type Round = typeof schema.rounds.$inferSelect;
export type Event = typeof schema.events.$inferSelect;
export type Appearance = typeof schema.appearances.$inferSelect;
export type Sanction = typeof schema.sanctions.$inferSelect;

import { cookies } from "next/headers";

export const getActiveSeason = cache(() => db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get()!);
export const getAllSeasons = cache(() => db.select().from(schema.seasons).orderBy(desc(schema.seasons.id)).all());
/** Season the visitor is looking at: the archive cookie (if valid) or the active one. Admin pages always use the active season. */
const seasonHolder = cache(() => ({ id: null as number | null })); // request-scoped
export function setSelectedSeason(id: number | null) { seasonHolder().id = id; }
export const getSeason = cache(() => {
  const sel = seasonHolder().id;
  if (sel) { const s = db.select().from(schema.seasons).where(eq(schema.seasons.id, sel)).get(); if (s) return s; }
  return getActiveSeason();
});
export const isArchive = () => getSeason().id !== getActiveSeason().id;
export const getGroups = cache(() => {
  const s = getSeason();
  return db.select().from(schema.groups).where(eq(schema.groups.seasonId, s.id)).orderBy(asc(schema.groups.name)).all();
});
export const getGroupsAdmin = cache(() => db.select().from(schema.groups).where(eq(schema.groups.seasonId, getActiveSeason().id)).orderBy(asc(schema.groups.name)).all());
export async function readSeasonCookie() {
  const v = (await cookies()).get("season")?.value;
  setSelectedSeason(v ? Number(v) || null : null);
}
export const getGroupByName = cache((name: string) => getGroups().find((g) => g.name.toUpperCase() === name.toUpperCase()));

export type MatchFull = Match & { round: Round; home: Team; away: Team };

/** Everything for a group, loaded once per request. Public view hides unpublished (draft) results; admin passes includeDrafts. */
export const loadGroup = cache((groupId: number, includeDrafts = false) => {
  const teams = db.select().from(schema.teams).where(eq(schema.teams.groupId, groupId)).all();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const rounds = db.select().from(schema.rounds).where(eq(schema.rounds.groupId, groupId)).orderBy(asc(schema.rounds.number)).all();
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const rawMatches = rounds.length
    ? db.select().from(schema.matches).where(inArray(schema.matches.roundId, rounds.map((r) => r.id))).all()
    : [];
  const matches: MatchFull[] = rawMatches.map((m) => {
    const hidden = !includeDrafts && !m.published && (m.status === "played" || m.status === "walkover");
    return { ...m, ...(hidden ? { status: "scheduled", homeGoals: null, awayGoals: null } : {}), round: roundById.get(m.roundId)!, home: teamById.get(m.homeId)!, away: teamById.get(m.awayId)! };
  });
  matches.sort((a, b) => a.round.number - b.round.number || a.id - b.id);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()); // YYYY-MM-DD
  const roundDate = (r: Round) => { const ms = matches.filter((m) => m.roundId === r.id); const ds = ms.map((m) => m.date ?? r.date); return ds.length ? ds.sort()[0] : r.date; };
  // last played round = the round of the most recently played match (by date)
  const playedMatches = matches.filter((m) => m.status === "played" || m.status === "walkover").sort((a, b) => (a.date ?? a.round.date).localeCompare(b.date ?? b.round.date) || a.round.number - b.round.number);
  const lastPlayedRound = playedMatches.length ? playedMatches[playedMatches.length - 1].round.number : 0;
  // next round = the earliest (by date) round that still has unplayed matches and is not in the past; else the earliest unplayed
  const unplayed = rounds.filter((r) => matches.some((m) => m.roundId === r.id && m.status !== "played" && m.status !== "walkover")).sort((a, b) => roundDate(a).localeCompare(roundDate(b)));
  const nextRound = (unplayed.find((r) => roundDate(r) >= today) ?? unplayed[0])?.number ?? rounds.length;
  return { teams, teamById, rounds, matches, lastPlayedRound, nextRound };
});

export function matchDate(m: MatchFull) { return m.date ?? m.round.date; }

export type Row = { team: Team; pj: number; w: number; d: number; l: number; gf: number; gc: number; pts: number; form: ("W" | "D" | "L")[] };

export function standings(groupId: number, uptoRound?: number): Row[] {
  const { teams, matches } = loadGroup(groupId);
  const rows = new Map<number, Row>(teams.map((t) => [t.id, { team: t, pj: 0, w: 0, d: 0, l: 0, gf: 0, gc: 0, pts: 0, form: [] }]));
  for (const m of matches) {
    if (m.status !== "played" && m.status !== "walkover") continue;
    if (uptoRound && m.round.number > uptoRound) continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const H = rows.get(m.homeId)!, A = rows.get(m.awayId)!;
    H.pj++; A.pj++; H.gf += m.homeGoals; H.gc += m.awayGoals; A.gf += m.awayGoals; A.gc += m.homeGoals;
    if (m.homeGoals > m.awayGoals) { H.w++; A.l++; H.pts += 3; H.form.push("W"); A.form.push("L"); }
    else if (m.homeGoals < m.awayGoals) { A.w++; H.l++; A.pts += 3; A.form.push("W"); H.form.push("L"); }
    else { H.d++; A.d++; H.pts++; A.pts++; H.form.push("D"); A.form.push("D"); }
  }
  return [...rows.values()].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || a.team.name.localeCompare(b.team.name, "ca"));
}

/* ---------- player statistics ---------- */
export type PlayerStats = {
  player: Player; pj: number; goals: number; pen: number; assists: number; yellows: number; reds: number; conceded: number;
  remaining: number; // suspension matches remaining
  activeSanction?: SanctionInfo;
};
export type SanctionInfo = { id: number | null; player: Player; matches: number; served: number; remaining: number; reason: string; startRound: number | null; startMatchId: number | null; notes?: string | null };

const loadPlayersData = cache((teamId: number) => {
  const players = db.select().from(schema.players).where(eq(schema.players.teamId, teamId)).all();
  const ids = players.map((p) => p.id);
  if (!ids.length) return { players, events: [] as Event[], apps: [] as Appearance[], sanctions: [] as Sanction[], assistsFor: [] as Event[] };
  const events = db.select().from(schema.events).where(inArray(schema.events.playerId, ids)).all();
  const assistsFor = db.select().from(schema.events).where(inArray(schema.events.assistId, ids)).all();
  const apps = db.select().from(schema.appearances).where(inArray(schema.appearances.playerId, ids)).all();
  const sanctions = db.select().from(schema.sanctions).where(inArray(schema.sanctions.playerId, ids)).all();
  return { players, events, apps, sanctions, assistsFor };
});

/** Team's matches in chronological play order (played only), used for serving suspensions. */
function teamPlayedMatches(team: Team) {
  const { matches } = loadGroup(team.groupId);
  return matches
    .filter((m) => (m.homeId === team.id || m.awayId === team.id) && (m.status === "played" || m.status === "walkover"))
    .sort((a, b) => matchDate(a).localeCompare(matchDate(b)) || a.round.number - b.round.number);
}

function servedAfter(team: Team, startMatchId: number | null, startRound: number | null, matchesTotal: number) {
  const played = teamPlayedMatches(team);
  let after: MatchFull[];
  if (startMatchId != null) {
    const idx = played.findIndex((m) => m.id === startMatchId);
    after = idx >= 0 ? played.slice(idx + 1) : played.filter((m) => m.round.number > (startRound ?? 0));
  } else {
    after = played.filter((m) => m.round.number >= (startRound ?? 0));
  }
  return Math.min(matchesTotal, after.length);
}

export function teamPlayerStats(team: Team): PlayerStats[] {
  const { players, events, apps, sanctions, assistsFor } = loadPlayersData(team.id);
  const season = getSeason();
  const { matches } = loadGroup(team.groupId);
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const orderKey = (mid: number) => { const m = matchById.get(mid); return m ? `${matchDate(m)}|${String(m.round.number).padStart(2, "0")}` : "9999"; };

  return players.map((p) => {
    const ev = events.filter((e) => e.playerId === p.id);
    const pj = apps.filter((a) => a.playerId === p.id && a.entered).length;
    const goals = ev.filter((e) => e.type === "gol" || e.type === "gol_pen").length;
    const pen = ev.filter((e) => e.type === "gol_pen").length;
    const assists = assistsFor.filter((e) => e.assistId === p.id).length;
    const yellows = ev.filter((e) => e.type === "groga" || e.type === "segona_groga").length;
    const reds = ev.filter((e) => e.type === "vermella" || e.type === "segona_groga").length;
    const conceded = apps.filter((a) => a.playerId === p.id).reduce((s, a) => s + (a.conceded ?? 0), 0);

    // sanctions: stored + accumulation
    const infos: SanctionInfo[] = [];
    for (const s of sanctions.filter((s) => s.playerId === p.id)) {
      const m = s.matchId ? matchById.get(s.matchId) : undefined;
      const served = s.servedOverride ?? servedAfter(team, s.matchId, s.roundNumber ?? m?.round.number ?? null, s.matches);
      infos.push({ id: s.id, player: p, matches: s.matches, served, remaining: Math.max(0, s.matches - served), reason: s.reason, startRound: m?.round.number ?? s.roundNumber ?? null, startMatchId: s.matchId, notes: s.notes });
    }
    const plainYellows = ev.filter((e) => e.type === "groga").sort((a, b) => orderKey(a.matchId).localeCompare(orderKey(b.matchId)));
    const n = season.yellowsForBan;
    for (let k = n; k <= plainYellows.length; k += n) {
      const trigger = plainYellows[k - 1];
      const m = matchById.get(trigger.matchId);
      const served = servedAfter(team, trigger.matchId, m?.round.number ?? null, 1);
      infos.push({ id: null, player: p, matches: 1, served, remaining: 1 - served, reason: "acumulacio", startRound: m?.round.number ?? null, startMatchId: trigger.matchId });
    }
    const active = infos.filter((i) => i.remaining > 0);
    const remaining = active.reduce((s, i) => s + i.remaining, 0);
    return { player: p, pj, goals, pen, assists, yellows, reds, conceded, remaining, activeSanction: active[0] };
  });
}

export function playerSanctions(team: Team, playerId: number): SanctionInfo[] {
  const { sanctions, events } = loadPlayersData(team.id);
  const { matches } = loadGroup(team.groupId);
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const p = loadPlayersData(team.id).players.find((x) => x.id === playerId)!;
  const infos: SanctionInfo[] = [];
  for (const s of sanctions.filter((s) => s.playerId === playerId)) {
    const m = s.matchId ? matchById.get(s.matchId) : undefined;
    const served = s.servedOverride ?? servedAfter(team, s.matchId, s.roundNumber ?? m?.round.number ?? null, s.matches);
    infos.push({ id: s.id, player: p, matches: s.matches, served, remaining: Math.max(0, s.matches - served), reason: s.reason, startRound: m?.round.number ?? s.roundNumber ?? null, startMatchId: s.matchId, notes: s.notes });
  }
  const n = getSeason().yellowsForBan;
  const plainYellows = events.filter((e) => e.playerId === playerId && e.type === "groga");
  for (let k = n; k <= plainYellows.length; k += n) {
    const m = matchById.get(plainYellows[k - 1].matchId);
    const served = servedAfter(team, plainYellows[k - 1].matchId, m?.round.number ?? null, 1);
    infos.push({ id: null, player: p, matches: 1, served, remaining: 1 - served, reason: "acumulacio", startRound: m?.round.number ?? null, startMatchId: plainYellows[k - 1].matchId });
  }
  return infos;
}

/* ---------- group-wide rankings ---------- */
export function groupPlayerStats(groupId: number) {
  const { teams } = loadGroup(groupId);
  return teams.flatMap((t) => teamPlayerStats(t).map((s) => ({ ...s, team: t })));
}

export function matchDetails(matchId: number) {
  const m = db.select().from(schema.matches).where(eq(schema.matches.id, matchId)).get();
  if (!m) return null;
  const round = db.select().from(schema.rounds).where(eq(schema.rounds.id, m.roundId)).get()!;
  const home = db.select().from(schema.teams).where(eq(schema.teams.id, m.homeId)).get()!;
  const away = db.select().from(schema.teams).where(eq(schema.teams.id, m.awayId)).get()!;
  const apps = db.select().from(schema.appearances).where(eq(schema.appearances.matchId, matchId)).all();
  const evs = db.select().from(schema.events).where(eq(schema.events.matchId, matchId)).all()
    .sort((a, b) => (a.minute == null ? 1 : 0) - (b.minute == null ? 1 : 0) || (a.minute ?? 0) - (b.minute ?? 0) || a.sort - b.sort);
  const pids = new Set([...apps.map((a) => a.playerId), ...evs.map((e) => e.playerId), ...evs.flatMap((e) => (e.assistId ? [e.assistId] : []))]);
  const players = pids.size ? db.select().from(schema.players).where(inArray(schema.players.id, [...pids])).all() : [];
  return { match: { ...m, round, home, away } as MatchFull, apps, events: evs, players: new Map(players.map((p) => [p.id, p])) };
}

export function playerName(p: Player | undefined, short = false) {
  if (!p) return "?";
  if (short) return p.surname;
  return [p.name, p.surname].filter(Boolean).join(" ");
}

export function playerLabel(p: Player | undefined) {
  if (!p) return "?";
  return `${p.surname}${p.name ? " " + p.name : ""}`;
}

export function isSuspendedFor(team: Team, playerId: number, match: MatchFull) {
  // suspended if any sanction has remaining > 0 counting only matches played before this one
  const infos = playerSanctions(team, playerId);
  if (!infos.length) return false;
  const played = teamPlayedMatches(team).filter((m) => m.id !== match.id && (matchDate(m) < matchDate(match) || (matchDate(m) === matchDate(match) && m.round.number < match.round.number)));
  for (const s of infos) {
    if (s.startMatchId === match.id) continue;
    let after: MatchFull[];
    if (s.startMatchId != null) { const idx = played.findIndex((m) => m.id === s.startMatchId); after = idx >= 0 ? played.slice(idx + 1) : played.filter((m) => m.round.number > (s.startRound ?? 0)); }
    else after = played.filter((m) => m.round.number >= (s.startRound ?? 0));
    if (after.length < s.matches) return true;
  }
  return false;
}


export const getSetting = cache((key: string) => db.select().from(schema.settings).where(eq(schema.settings.key, key)).get()?.value ?? null);
export function siteLogo() { const l = getSetting("logo"); return l ? `/uploads/${l}` : "/logo.png"; }

export function popupSettings() {
  if (getSetting("popup_enabled") !== "1") return null;
  // optional window (Europe/Madrid local time, "YYYY-MM-DDTHH:mm")
  const now = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(" ", "T");
  const from = getSetting("popup_from"), to = getSetting("popup_to");
  if (from && now < from) return null;
  if (to && now > to) return null;
  return { id: getSetting("popup_version") ?? "1", title: getSetting("popup_title") ?? "", body: getSetting("popup_body") ?? "", image: getSetting("popup_image") };
}

export const teamKey = (name: string) => name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
