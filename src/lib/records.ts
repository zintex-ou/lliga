import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { loadGroup, matchDate, type MatchFull, type Team, type Player } from "@/lib/stats";

type Season = typeof schema.seasons.$inferSelect;
type Group = typeof schema.groups.$inferSelect;

export const seasonsAll = cache(() => db.select().from(schema.seasons).orderBy(asc(schema.seasons.id)).all());
export const groupsOf = cache((seasonId: number) => db.select().from(schema.groups).where(eq(schema.groups.seasonId, seasonId)).orderBy(asc(schema.groups.name)).all());

/** Played matches of a set of groups, with season/group attached. */
function playedMatches(groups: Group[], seasons: Season[]) {
  const out: (MatchFull & { season: Season; group: Group })[] = [];
  for (const g of groups) {
    const season = seasons.find((s) => s.id === g.seasonId)!;
    for (const m of loadGroup(g.id).matches) if ((m.status === "played" || m.status === "walkover") && m.homeGoals != null && m.awayGoals != null) out.push({ ...m, season, group: g });
  }
  return out;
}

export type TeamRecord = { team: Team; season: Season; value: number; label?: string };
export type MatchRecord = { match: MatchFull & { season: Season; group: Group }; value: number };
export type PlayerRecord = { player: Player; team: Team; season: Season; value: number; matchId?: number };

const nameKey = (t: Team) => t.name.trim().toLowerCase();

/** Team streaks and results within a list of matches (chronological). */
export function teamSequence(teamId: number, matches: MatchFull[]) {
  const mine = matches.filter((m) => m.homeId === teamId || m.awayId === teamId).sort((a, b) => matchDate(a).localeCompare(matchDate(b)) || a.round.number - b.round.number);
  return mine.map((m) => {
    const home = m.homeId === teamId; const gf = home ? m.homeGoals! : m.awayGoals!; const ga = home ? m.awayGoals! : m.homeGoals!;
    return { m, home, gf, ga, r: gf > ga ? "W" : gf < ga ? "L" : "D" as "W" | "D" | "L" };
  });
}
function longestStreak(seq: { r: string }[], ok: (r: string) => boolean) { let best = 0, cur = 0; for (const s of seq) { cur = ok(s.r) ? cur + 1 : 0; best = Math.max(best, cur); } return best; }
function currentStreak(seq: { r: string }[]) {
  if (!seq.length) return { kind: "none" as const, n: 0 };
  const last = seq[seq.length - 1].r; let n = 0;
  if (last === "W") { for (let i = seq.length - 1; i >= 0 && seq[i].r === "W"; i--) n++; return { kind: "W" as const, n }; }
  if (last === "L") { for (let i = seq.length - 1; i >= 0 && seq[i].r === "L"; i--) n++; return { kind: "L" as const, n }; }
  for (let i = seq.length - 1; i >= 0 && seq[i].r !== "L"; i--) n++; return { kind: "U" as const, n }; // unbeaten incl. draws
}

export function teamSummary(team: Team) {
  const { matches } = loadGroup(team.groupId);
  const seq = teamSequence(team.id, matches.filter((m) => (m.status === "played" || m.status === "walkover") && m.homeGoals != null));
  const home = seq.filter((s) => s.home), away = seq.filter((s) => !s.home);
  const rec = (xs: typeof seq) => ({ w: xs.filter((x) => x.r === "W").length, d: xs.filter((x) => x.r === "D").length, l: xs.filter((x) => x.r === "L").length, gf: xs.reduce((a, x) => a + x.gf, 0), ga: xs.reduce((a, x) => a + x.ga, 0) });
  const bestWin = seq.filter((s) => s.r === "W").sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];
  const worstLoss = seq.filter((s) => s.r === "L").sort((a, b) => (b.ga - b.gf) - (a.ga - a.gf) || b.ga - a.ga)[0];
  const cleanSheets = seq.filter((s) => s.ga === 0).length;
  return { seq, all: rec(seq), home: rec(home), away: rec(away), bestWin, worstLoss, cleanSheets, streak: currentStreak(seq), longestUnbeaten: longestStreak(seq, (r) => r !== "L"), longestWin: longestStreak(seq, (r) => r === "W") };
}

/** Head-to-head across every season, matched by team name. */
export function headToHead(a: Team, b: Team) {
  const seasons = seasonsAll();
  const groups = seasons.flatMap((s) => groupsOf(s.id));
  const all = playedMatches(groups, seasons);
  const ka = nameKey(a), kb = nameKey(b);
  const meetings = all.filter((m) => (nameKey(m.home) === ka && nameKey(m.away) === kb) || (nameKey(m.home) === kb && nameKey(m.away) === ka))
    .sort((x, y) => matchDate(y).localeCompare(matchDate(x)));
  let wa = 0, wb = 0, d = 0, ga = 0, gb = 0;
  for (const m of meetings) {
    const aHome = nameKey(m.home) === ka; const gA = aHome ? m.homeGoals! : m.awayGoals!; const gB = aHome ? m.awayGoals! : m.homeGoals!;
    ga += gA; gb += gB; if (gA > gB) wa++; else if (gA < gB) wb++; else d++;
  }
  return { meetings, wa, wb, d, ga, gb };
}

/** Records for one season (all groups) or all time (seasonId null). */
export function records(seasonId: number | null) {
  const seasons = seasonId ? seasonsAll().filter((s) => s.id === seasonId) : seasonsAll();
  const groups = seasons.flatMap((s) => groupsOf(s.id));
  const matches = playedMatches(groups, seasons);
  const groupTeams = new Map(groups.map((g) => [g.id, loadGroup(g.id).teams]));

  // --- match records
  const biggestWin = [...matches].sort((a, b) => Math.abs(b.homeGoals! - b.awayGoals!) - Math.abs(a.homeGoals! - a.awayGoals!) || (b.homeGoals! + b.awayGoals!) - (a.homeGoals! + a.awayGoals!)).slice(0, 3).map((m) => ({ match: m, value: Math.abs(m.homeGoals! - m.awayGoals!) }));
  const mostGoals = [...matches].sort((a, b) => (b.homeGoals! + b.awayGoals!) - (a.homeGoals! + a.awayGoals!)).slice(0, 3).map((m) => ({ match: m, value: m.homeGoals! + m.awayGoals! }));

  // --- team records (per season-team)
  const teamRecs: { team: Team; season: Season; group: Group; sum: ReturnType<typeof teamSummary> }[] = [];
  for (const g of groups) for (const t of groupTeams.get(g.id)!) {
    const gm = matches.filter((m) => m.group.id === g.id);
    const seq = teamSequence(t.id, gm);
    if (!seq.length) continue;
    const season = seasons.find((s) => s.id === g.seasonId)!;
    teamRecs.push({ team: t, season, group: g, sum: { ...teamSummary(t), seq } });
  }
  const top = <T,>(xs: T[], val: (x: T) => number, n = 3) => xs.map((x) => ({ x, v: val(x) })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v).slice(0, n).map((r) => ({ ...r.x, value: r.v }));
  const longestUnbeaten = top(teamRecs, (r) => r.sum.longestUnbeaten);
  const longestWin = top(teamRecs, (r) => r.sum.longestWin);
  const mostGoalsTeam = top(teamRecs, (r) => r.sum.all.gf);
  const bestDefense = teamRecs.filter((r) => r.sum.seq.length >= 3).map((r) => ({ ...r, value: r.sum.all.ga / r.sum.seq.length })).sort((a, b) => a.value - b.value).slice(0, 3);
  const cleanSheets = top(teamRecs, (r) => r.sum.cleanSheets);

  // --- player records
  const matchIds = matches.map((m) => m.id);
  const evs = matchIds.length ? db.select().from(schema.events).where(inArray(schema.events.matchId, matchIds)).all() : [];
  const apps = matchIds.length ? db.select().from(schema.appearances).where(inArray(schema.appearances.matchId, matchIds)).all() : [];
  const pids = [...new Set([...evs.map((e) => e.playerId), ...apps.map((a) => a.playerId)])];
  const players = pids.length ? db.select().from(schema.players).where(inArray(schema.players.id, pids)).all() : [];
  const pById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(groups.flatMap((g) => groupTeams.get(g.id)!).map((t) => [t.id, t]));
  const seasonOfTeam = (t: Team) => seasons.find((s) => groupsOf(s.id).some((g) => g.id === t.groupId))!;
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // aggregate by player identity across seasons (surname+name+dob) when all-time
  const pkey = (p: Player) => seasonId ? String(p.id) : `${p.surname}|${p.name}|${p.dob ?? ""}`.toLowerCase();
  const agg = new Map<string, { player: Player; team: Team; goals: number; pj: number; conceded: number; cs: number; hat: number; yellows: number; reds: number }>();
  const get = (p: Player) => { const k = pkey(p); if (!agg.has(k)) agg.set(k, { player: p, team: teamById.get(p.teamId)!, goals: 0, pj: 0, conceded: 0, cs: 0, hat: 0, yellows: 0, reds: 0 }); const a = agg.get(k)!; if (p.id > a.player.id) { a.player = p; a.team = teamById.get(p.teamId)!; } return a; };
  for (const e of evs) { const p = pById.get(e.playerId); if (!p) continue; const a = get(p); if (e.type === "gol" || e.type === "gol_pen") a.goals++; if (e.type === "groga" || e.type === "segona_groga") a.yellows++; if (e.type === "vermella" || e.type === "segona_groga") a.reds++; }
  for (const ap of apps) { const p = pById.get(ap.playerId); if (!p || !ap.entered) continue; const a = get(p); a.pj++; if (p.position === "POR") { a.conceded += ap.conceded ?? 0; if ((ap.conceded ?? 0) === 0 && ap.conceded != null) a.cs++; } }
  // hat-tricks: 3+ goals in a match
  const perMatch = new Map<string, number>();
  for (const e of evs) if (e.type === "gol" || e.type === "gol_pen") { const k = `${e.matchId}|${e.playerId}`; perMatch.set(k, (perMatch.get(k) ?? 0) + 1); }
  const hatTricks: PlayerRecord[] = [];
  for (const [k, n] of perMatch) if (n >= 3) { const [mid, pid] = k.split("|").map(Number); const p = pById.get(pid); if (p) { get(p).hat++; hatTricks.push({ player: p, team: teamById.get(p.teamId)!, season: seasonOfTeam(teamById.get(p.teamId)!), value: n, matchId: mid }); } }
  hatTricks.sort((a, b) => b.value - a.value);
  const list = [...agg.values()];
  const topScorers = list.filter((a) => a.goals > 0).sort((a, b) => b.goals - a.goals || a.pj - b.pj).slice(0, 5).map((a) => ({ player: a.player, team: a.team, season: seasonOfTeam(a.team), value: a.goals }));
  const bestGk = list.filter((a) => a.player.position === "POR" && a.pj >= 3).map((a) => ({ player: a.player, team: a.team, season: seasonOfTeam(a.team), value: a.conceded / a.pj, cs: a.cs, pj: a.pj })).sort((a, b) => a.value - b.value).slice(0, 5);
  const cleanSheetGk = list.filter((a) => a.player.position === "POR" && a.cs > 0).sort((a, b) => b.cs - a.cs).slice(0, 5).map((a) => ({ player: a.player, team: a.team, season: seasonOfTeam(a.team), value: a.cs }));
  const mostApps = list.filter((a) => a.pj > 0).sort((a, b) => b.pj - a.pj).slice(0, 5).map((a) => ({ player: a.player, team: a.team, season: seasonOfTeam(a.team), value: a.pj }));
  const mostCards = list.filter((a) => a.yellows + a.reds > 0).sort((a, b) => (b.yellows + 3 * b.reds) - (a.yellows + 3 * a.reds)).slice(0, 5).map((a) => ({ player: a.player, team: a.team, season: seasonOfTeam(a.team), value: a.yellows, reds: a.reds }));

  // champions per season/group (final standings) — for the hall of fame
  const champions = seasons.flatMap((s) => groupsOf(s.id).map((g) => {
    const ms = matches.filter((m) => m.group.id === g.id);
    if (!ms.length) return null;
    const pts = new Map<number, { t: Team; pts: number; gd: number; gf: number }>();
    for (const t of groupTeams.get(g.id)!) pts.set(t.id, { t, pts: 0, gd: 0, gf: 0 });
    for (const m of ms) { const H = pts.get(m.homeId)!, A = pts.get(m.awayId)!; H.gd += m.homeGoals! - m.awayGoals!; A.gd += m.awayGoals! - m.homeGoals!; H.gf += m.homeGoals!; A.gf += m.awayGoals!; if (m.homeGoals! > m.awayGoals!) H.pts += 3; else if (m.homeGoals! < m.awayGoals!) A.pts += 3; else { H.pts++; A.pts++; } }
    const first = [...pts.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)[0];
    const total = groupTeams.get(g.id)!.length; const played = ms.length; const complete = played >= total * (total - 1);
    return { season: s, group: g, team: first.t, pts: first.pts, complete };
  }).filter(Boolean)) as { season: Season; group: Group; team: Team; pts: number; complete: boolean }[];

  return { seasons, matchesCount: matches.length, biggestWin, mostGoals, longestUnbeaten, longestWin, mostGoalsTeam, bestDefense, cleanSheets, topScorers, bestGk, cleanSheetGk, mostApps, mostCards, hatTricks: hatTricks.slice(0, 8), champions, matchById };
}
