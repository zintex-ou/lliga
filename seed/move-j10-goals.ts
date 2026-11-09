// Move auto-attributed goals from round 10 to round 9 (all groups), except CF Fogars' match. Re-runnable.
import { db, schema } from "../src/db";
import { eq, and, inArray } from "drizzle-orm";

const FROM = 10, TO = 9;
const fog = db.select().from(schema.teams).all().find((t) => /fogars/i.test(t.name))!;
const groups = db.select().from(schema.groups).all();
let moved = 0, pending = 0;
for (const g of groups) {
  const rounds = db.select().from(schema.rounds).where(eq(schema.rounds.groupId, g.id)).all();
  const rFrom = rounds.find((r) => r.number === FROM), rTo = rounds.find((r) => r.number === TO);
  if (!rFrom || !rTo) continue;
  const mFrom = db.select().from(schema.matches).where(eq(schema.matches.roundId, rFrom.id)).all().filter((m) => m.homeId !== fog.id && m.awayId !== fog.id);
  const mTo = db.select().from(schema.matches).where(eq(schema.matches.roundId, rTo.id)).all();
  const players = new Map(db.select().from(schema.players).all().map((p) => [p.id, p]));
  for (const m of mFrom) {
    const evs = db.select().from(schema.events).where(and(eq(schema.events.matchId, m.id), inArray(schema.events.type, ["gol", "gol_pen"]))).all();
    if (!evs.length) continue;
    db.delete(schema.events).where(inArray(schema.events.id, evs.map((e) => e.id))).run();
    for (const e of evs) {
      const p = players.get(e.playerId)!;
      const t = mTo.find((x) => (x.homeId === p.teamId || x.awayId === p.teamId) && x.status === "played");
      const tName = db.select().from(schema.teams).where(eq(schema.teams.id, p.teamId)).get()!.name;
      if (!t) { pending++; console.log(`? ${p.name} ${p.surname} (${tName}): no J${TO} match`); continue; }
      const scored = t.homeId === p.teamId ? t.homeGoals ?? 0 : t.awayGoals ?? 0;
      const cur = db.select().from(schema.events).where(and(eq(schema.events.matchId, t.id), inArray(schema.events.type, ["gol", "gol_pen"]))).all().filter((x) => players.get(x.playerId)?.teamId === p.teamId).length;
      if (cur >= scored) { pending++; console.log(`? ${p.name} ${p.surname} (${tName}): J${TO} match already full (${cur}/${scored})`); continue; }
      db.insert(schema.events).values({ matchId: t.id, playerId: p.id, type: "gol", minute: null, sort: 100 + cur }).run();
      moved++; console.log(`✓ ${p.name} ${p.surname} (${tName}): J${FROM} → J${TO}`);
    }
  }
}
console.log(`done: moved ${moved}, pending ${pending}`);
