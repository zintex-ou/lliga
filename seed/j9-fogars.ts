// J9 2025-26 Grup B: Restaurant Amura 2-6 CF Fogars Veterans — result + goals in order.
// Fill MIN with minutes when known (null = unknown). Re-runnable: replaces the match's goal events.
import { db, schema } from "../src/db";
import { eq, and, like, inArray } from "drizzle-orm";

const ROUND = 9, HOME = 2, AWAY = 6;
// [who, type] in chronological order. who: "them" or a Fogars surname fragment (case-insensitive).
// [who, type, minute, assist surname fragment]
const GOALS: [string, "gol" | "gol_pen", number | null, string | null][] = [
  ["them", "gol", 17, null],                     // 1-0
  ["Andreev", "gol", 43, "Coloma"],              // 1-1
  ["Zinchenko", "gol_pen", 51, null],            // 1-2
  ["Balleste Planas", "gol", 55, "Balleste Da"], // 1-3 Óscar, asst. Miquel
  ["Andreev", "gol", 65, "Rodriguez Delyhonny"], // 1-4, asst. Franco
  ["Andreev", "gol", 75, "Balleste Da"],         // 1-5
  ["them", "gol", 77, null],                     // 2-5
  ["Andreev", "gol", 92, "Balleste Da"],         // 2-6
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const teams = db.select().from(schema.teams).all();
const fog = teams.find((t) => /fogars/i.test(t.name))!;
const amu = teams.find((t) => /amura/i.test(t.name))!;
const round = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, fog.groupId), eq(schema.rounds.number, ROUND))).get()!;
const m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, round.id), eq(schema.matches.homeId, amu.id), eq(schema.matches.awayId, fog.id))).get();
if (!m) throw new Error("match not found");
console.log("match", m.id, `${amu.name} ${m.homeGoals ?? "-"}-${m.awayGoals ?? "-"} ${fog.name} (${m.status})`);

db.update(schema.matches).set({ status: "played", homeGoals: HOME, awayGoals: AWAY, updatedAt: new Date().toISOString() }).where(eq(schema.matches.id, m.id)).run();

const squad = db.select().from(schema.players).where(eq(schema.players.teamId, fog.id)).all();
let ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, amu.id), like(schema.players.surname, "Jugador %"))).get();
if (!ph) [ph] = db.insert(schema.players).values({ teamId: amu.id, surname: "Jugador 1", name: "", position: "MIG" }).returning().all();

const del = db.delete(schema.events).where(and(eq(schema.events.matchId, m.id), inArray(schema.events.type, ["gol", "gol_pen"]))).run();
console.log("removed goal events:", del.changes);

const find = (frag: string) => squad.find((x) => norm(`${x.name} ${x.surname}`).includes(norm(frag)));
GOALS.forEach(([who, type, minute, asst], i) => {
  const p = who === "them" ? ph! : find(who);
  if (!p) throw new Error("player not found: " + who);
  const a = asst ? find(asst) : null;
  if (asst && !a) throw new Error("assist player not found: " + asst);
  db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type, minute, assistId: a?.id ?? null, sort: i }).run();
  console.log("✓", i + 1, who === "them" ? amu.name : `${p.name} ${p.surname}`, type, minute ?? "", a ? `(${a.name} ${a.surname})` : "");
});
console.log("done");
