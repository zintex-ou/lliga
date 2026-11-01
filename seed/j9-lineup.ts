// J9 Restaurant Amura 2-6 CF Fogars Veterans: Fogars lineup (appearances). Re-runnable (replaces Fogars appearances for the match).
import { db, schema } from "../src/db";
import { eq, and, inArray } from "drizzle-orm";

const TITULARS = ["Ievgen", "Hlot", "Delgado", "Farafontov", "Stoiachenko", "Miquel Balleste", "Oscar Balleste", "Josep", "Andreev", "Franco", "Jesus"];
const SUPLENTS = ["Jhoan", "Segui", "Tiurin", "Reutsa", "Ortiz", "Martinez"]; // all entered
const CONCEDED: Record<string, number> = { Ievgen: 2 };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const teams = db.select().from(schema.teams).all();
const fog = teams.find((t) => /fogars/i.test(t.name))!, amu = teams.find((t) => /amura/i.test(t.name))!;
const round = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, fog.groupId), eq(schema.rounds.number, 9))).get()!;
const m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, round.id), eq(schema.matches.homeId, amu.id), eq(schema.matches.awayId, fog.id))).get();
if (!m) throw new Error("match not found");
const squad = db.select().from(schema.players).where(eq(schema.players.teamId, fog.id)).all();
const find = (frag: string) => {
  const f = norm(frag);
  const hits = squad.filter((p) => norm(`${p.name} ${p.surname}`).includes(f) || norm(`${p.surname} ${p.name}`).includes(f));
  if (hits.length !== 1) throw new Error(`${frag}: ${hits.length} matches (${hits.map((p) => `${p.name} ${p.surname}`).join(", ")})`);
  return hits[0];
};
const rows = [...TITULARS.map((f) => ({ f, role: "titular" })), ...SUPLENTS.map((f) => ({ f, role: "suplent" }))].map((x) => ({ ...x, p: find(x.f) }));
const ids = squad.map((p) => p.id);
db.delete(schema.appearances).where(and(eq(schema.appearances.matchId, m.id), inArray(schema.appearances.playerId, ids))).run();
for (const r of rows) {
  db.insert(schema.appearances).values({ matchId: m.id, playerId: r.p.id, role: r.role, entered: true, conceded: CONCEDED[r.f] ?? null }).run();
  console.log(`✓ ${r.role === "titular" ? "T" : "S"} ${r.p.name} ${r.p.surname}`);
}
console.log("done", rows.length);
