import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { loadGroup, matchDate, teamPlayerStats, playerSanctions } from "@/lib/stats";
import { age } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Public read-only player card for club sites: same data as the public player page (no date of birth, age only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = db.select().from(schema.players).where(eq(schema.players.id, Number(id))).get();
  if (!player) return NextResponse.json({ error: "not found" }, { status: 404 });
  const team = db.select().from(schema.teams).where(eq(schema.teams.id, player.teamId)).get()!;
  const st = teamPlayerStats(team).find((s) => s.player.id === player.id);
  if (!st) return NextResponse.json({ error: "not found" }, { status: 404 });
  const sanctions = playerSanctions(team, player.id);
  const apps = db.select().from(schema.appearances).where(eq(schema.appearances.playerId, player.id)).all();
  const evs = db.select().from(schema.events).where(eq(schema.events.playerId, player.id)).all();
  const assisted = db.select().from(schema.events).where(eq(schema.events.assistId, player.id)).all();
  const mids = new Set([...apps.map((x) => x.matchId), ...evs.map((x) => x.matchId), ...assisted.map((x) => x.matchId)]);
  const { matches } = loadGroup(team.groupId);
  const tinfo = (t: typeof team) => ({ id: t.id, name: t.name, slug: t.slug, short: t.short, logo: t.logo ? `/uploads/${t.logo}` : null, town: t.town, field: t.field });
  const history = matches.filter((m) => mids.has(m.id)).sort((a, b) => matchDate(a).localeCompare(matchDate(b)) || a.round.number - b.round.number).map((m) => {
    const e = evs.filter((x) => x.matchId === m.id);
    const ap = apps.find((x) => x.matchId === m.id);
    return {
      id: m.id, round: m.round.number, date: matchDate(m), home: tinfo(m.home), away: tinfo(m.away), homeGoals: m.homeGoals, awayGoals: m.awayGoals, status: m.status,
      goals: e.filter((x) => x.type === "gol" || x.type === "gol_pen").length, pen: e.filter((x) => x.type === "gol_pen").length,
      missedPen: e.filter((x) => x.type === "pen_fallat").length,
      assists: assisted.filter((x) => x.matchId === m.id).length,
      yellows: e.filter((x) => x.type === "groga" || x.type === "segona_groga").length, reds: e.filter((x) => x.type === "vermella" || x.type === "segona_groga").length,
      sub: ap ? !ap.entered && ap.role !== "titular" : false, conceded: ap?.conceded ?? null,
    };
  });
  return NextResponse.json({
    player: { id: player.id, name: player.name, surname: player.surname, position: player.position, dorsal: player.dorsal, photo: player.photo ? `/uploads/${player.photo}` : null, age: age(player.dob), active: player.active },
    team: tinfo(team),
    stats: { pj: st.pj, goals: st.goals, pen: st.pen, assists: st.assists, yellows: st.yellows, reds: st.reds, conceded: st.conceded, suspended: st.remaining },
    sanctions: sanctions.map((s) => ({ reason: s.reason, matches: s.matches, remaining: s.remaining, startRound: s.startRound, notes: s.notes ?? null })),
    history,
  });
}
