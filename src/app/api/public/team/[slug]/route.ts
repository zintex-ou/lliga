import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, asc, inArray } from "drizzle-orm";
import { getActiveSeason, loadGroup, standings, teamPlayerStats, matchDate } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Public read-only feed for a team's own website (club sites). No personal data beyond what the public pages show. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).get();
  if (!team) return NextResponse.json({ error: "not found" }, { status: 404 });
  const season = getActiveSeason();
  const group = db.select().from(schema.groups).where(eq(schema.groups.id, team.groupId)).get()!;
  if (group.seasonId !== season.id) return NextResponse.json({ error: "not active season" }, { status: 404 });
  const data = loadGroup(group.id);
  const mine = data.matches.filter((m) => m.homeId === team.id || m.awayId === team.id).sort((a, b) => matchDate(a).localeCompare(matchDate(b)) || a.round.number - b.round.number);
  const ids = mine.map((m) => m.id);
  const evs = ids.length ? db.select().from(schema.events).where(inArray(schema.events.matchId, ids)).all() : [];
  const pids = [...new Set([...evs.map((e) => e.playerId), ...evs.flatMap((e) => (e.assistId ? [e.assistId] : []))])];
  const pl = pids.length ? new Map(db.select().from(schema.players).where(inArray(schema.players.id, pids)).all().map((p) => [p.id, p])) : new Map();
  const pname = (id: number | null) => { const p = id ? pl.get(id) : null; return p ? `${p.name} ${p.surname}`.trim() : null; };
  /** "Josep Lluis Coloma Martos" → "J. L. Coloma" */
  const pshort = (id: number | null) => { const p = id ? pl.get(id) : null; return p ? `${p.name.trim().split(/\s+/).filter(Boolean).map((w: string) => w[0] + ".").join(" ")} ${p.surname.trim().split(/\s+/)[0]}`.trim() : null; };
  const tinfo = (t: typeof team) => ({ id: t.id, name: t.name, slug: t.slug, short: t.short, logo: t.logo ? `/uploads/${t.logo}` : null, town: t.town, field: t.field });
  const matches = mine.map((m) => ({
    id: m.id, round: m.round.number, date: matchDate(m), time: m.time, field: m.field, status: m.status, notes: m.notes,
    home: tinfo(m.home), away: tinfo(m.away), homeGoals: m.homeGoals, awayGoals: m.awayGoals,
    events: evs.filter((e) => e.matchId === m.id && (e.type === "gol" || e.type === "gol_pen"))
      .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.sort - b.sort)
      .map((e) => ({ type: e.type, minute: e.minute, player: pname(e.playerId), playerShort: pshort(e.playerId), playerId: e.playerId, assist: pname(e.assistId), assistShort: pshort(e.assistId), assistId: e.assistId, team: pl.get(e.playerId)?.teamId === team.id ? "mine" : "other" })),
  }));
  const rows = standings(group.id).map((r, i) => ({ pos: i + 1, team: tinfo(r.team), pj: r.pj, w: r.w, d: r.d, l: r.l, gf: r.gf, gc: r.gc, dg: r.gf - r.gc, pts: r.pts, form: r.form }));
  const squad = teamPlayerStats(team).filter((s) => s.player.active || s.pj > 0).map((s) => ({
    id: s.player.id, name: s.player.name, surname: s.player.surname, position: s.player.position, dorsal: s.player.dorsal, photo: s.player.photo ? `/uploads/${s.player.photo}` : null,
    pj: s.pj, goals: s.goals, pen: s.pen, assists: s.assists, yellows: s.yellows, reds: s.reds, suspended: s.remaining,
  }));
  const staff = db.select().from(schema.staff).where(eq(schema.staff.teamId, team.id)).orderBy(asc(schema.staff.sort)).all().map((s) => ({ name: s.name, role: s.role, phone: s.phone, email: s.email }));
  const played = matches.filter((m) => m.status === "played" || m.status === "walkover");
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = matches.filter((m) => m.status === "scheduled" && m.date >= today);
  return NextResponse.json({
    season: season.name, group: { id: group.id, name: group.name, topSlots: group.topSlots, relegSlots: group.relegSlots },
    team: { ...tinfo(team), photo: team.photo ? `/uploads/${team.photo}` : null, colors: team.colors, founded: team.founded, info: team.info },
    lastMatch: played.at(-1) ?? null, nextMatch: upcoming[0] ?? null, matches, standings: rows, squad, staff, generatedAt: new Date().toISOString(),
  }, { headers: { "cache-control": "public, max-age=120", "access-control-allow-origin": "*" } });
}
