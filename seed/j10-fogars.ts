// J10 (7 Nov 2026): CF Fogars Veterans won 3-0. Goals: Hlot 37', 45'; Andreev 70'. Re-runnable.
import { db, schema } from "../src/db";
import { eq, and, inArray } from "drizzle-orm";

const ROUND = 10, OURS = 3, THEIRS = 0;
const GOALS: [string, "gol" | "gol_pen", number | null, string | null][] = [
  ["Hlot", "gol", 37, null],
  ["Hlot", "gol", 45, null],
  ["Andreev", "gol", 70, null],
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fog = db.select().from(schema.teams).all().find((t) => /fogars/i.test(t.name))!;
const round = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, fog.groupId), eq(schema.rounds.number, ROUND))).get()!;
const m = db.select().from(schema.matches).where(eq(schema.matches.roundId, round.id)).all().find((x) => x.homeId === fog.id || x.awayId === fog.id);
if (!m) throw new Error("match not found");
const home = m.homeId === fog.id;
const opp = db.select().from(schema.teams).where(eq(schema.teams.id, home ? m.awayId : m.homeId)).get()!;
console.log(`match ${m.id}: ${home ? fog.name : opp.name} vs ${home ? opp.name : fog.name} (${m.status}, ${m.homeGoals ?? "-"}-${m.awayGoals ?? "-"})`);
db.update(schema.matches).set({ status: "played", homeGoals: home ? OURS : THEIRS, awayGoals: home ? THEIRS : OURS, updatedAt: new Date().toISOString() }).where(eq(schema.matches.id, m.id)).run();

const squad = db.select().from(schema.players).where(eq(schema.players.teamId, fog.id)).all();
const find = (frag: string) => { const h = squad.filter((x) => norm(`${x.name} ${x.surname}`).includes(norm(frag))); if (h.length !== 1) throw new Error(`${frag}: ${h.length} matches (${h.map((p) => `${p.name} ${p.surname}`).join(", ")})`); return h[0]; };
const del = db.delete(schema.events).where(and(eq(schema.events.matchId, m.id), inArray(schema.events.type, ["gol", "gol_pen"]))).run();
console.log("removed goal events:", del.changes);
GOALS.forEach(([who, type, minute, asst], i) => {
  const p = find(who), a = asst ? find(asst) : null;
  db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type, minute, assistId: a?.id ?? null, sort: i }).run();
  console.log("✓", minute, `${p.name} ${p.surname}`, type, a ? `(${a.name} ${a.surname})` : "");
});
console.log(`done: ${home ? OURS : THEIRS}-${home ? THEIRS : OURS}`);
