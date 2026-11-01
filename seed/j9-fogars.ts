// J9 2025-26 Grup B: Restaurant Amura 2-6 CF Fogars Veterans — result + goals in order.
// Fill MIN with minutes when known (null = unknown). Re-runnable: replaces the match's goal events.
import { db, schema } from "../src/db";
import { eq, and, like, inArray } from "drizzle-orm";

const ROUND = 9, HOME = 2, AWAY = 6;
// [who, type] in chronological order. who: "them" or a Fogars surname fragment (case-insensitive).
const GOALS: [string, "gol" | "gol_pen", number | null][] = [
  ["them", "gol_pen", null],     // 0-1
  ["Andreev", "gol", null],      // 1-1
  ["Zinchenko", "gol_pen", null],// 2-1
  ["Balleste Planas", "gol", null], // 3-1 Óscar
  ["Andreev", "gol", null],      // 4-1
  ["Andreev", "gol", null],      // 5-1
  ["them", "gol", null],         // 5-2
  ["Andreev", "gol", null],      // 6-2
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

GOALS.forEach(([who, type, minute], i) => {
  const p = who === "them" ? ph! : squad.find((x) => norm(`${x.name} ${x.surname}`).includes(norm(who)));
  if (!p) throw new Error("player not found: " + who);
  db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type, minute, sort: i }).run();
  console.log("✓", i + 1, who === "them" ? amu.name : `${p.name} ${p.surname}`, type, minute ?? "");
});
console.log("done");
