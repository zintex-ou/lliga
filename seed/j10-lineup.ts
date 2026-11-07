// J10 CF Fogars 3-0 FC Palafrugell: lineup + assists. Re-runnable.
import { db, schema } from "../src/db";
import { eq, and, inArray, asc } from "drizzle-orm";

const ROUND = 10;
const TITULARS = ["Lopez Fernandez", "Stoiachenko", "Farafontov", "Delgado", "Jhoan", "Andreev", "Coloma", "Miquel Balleste", "Oscar Balleste", "Hlot", "Franco"];
const SUPLENTS = ["Segui", "Ezequiel", "Ortiz", "Errouchani"]; // all entered
const CONCEDED: Record<string, number> = { "Lopez Fernandez": 0 };
const ASSISTS: (string | null)[] = ["Stoiachenko", "Andreev", "Segui"]; // per goal, in minute order

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fog = db.select().from(schema.teams).all().find((t) => /fogars/i.test(t.name))!;
const round = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, fog.groupId), eq(schema.rounds.number, ROUND))).get()!;
const m = db.select().from(schema.matches).where(eq(schema.matches.roundId, round.id)).all().find((x) => x.homeId === fog.id || x.awayId === fog.id);
if (!m) throw new Error("match not found");
const squad = db.select().from(schema.players).where(eq(schema.players.teamId, fog.id)).all();
const find = (frag: string) => { const h = squad.filter((p) => norm(`${p.name} ${p.surname}`).includes(norm(frag))); if (h.length !== 1) throw new Error(`${frag}: ${h.length} matches (${h.map((p) => `${p.name} ${p.surname}`).join(", ")})`); return h[0]; };
const rows = [...TITULARS.map((f) => ({ f, role: "titular" })), ...SUPLENTS.map((f) => ({ f, role: "suplent" }))].map((x) => ({ ...x, p: find(x.f) }));
db.delete(schema.appearances).where(and(eq(schema.appearances.matchId, m.id), inArray(schema.appearances.playerId, squad.map((p) => p.id)))).run();
for (const r of rows) { db.insert(schema.appearances).values({ matchId: m.id, playerId: r.p.id, role: r.role, entered: true, conceded: CONCEDED[r.f] ?? null }).run(); console.log(`✓ ${r.role === "titular" ? "T" : "S"} ${r.p.name} ${r.p.surname}`); }
const goals = db.select().from(schema.events).where(and(eq(schema.events.matchId, m.id), inArray(schema.events.type, ["gol", "gol_pen"]))).orderBy(asc(schema.events.minute), asc(schema.events.sort)).all().filter((e) => squad.some((p) => p.id === e.playerId));
goals.forEach((g, i) => { const a = ASSISTS[i] ? find(ASSISTS[i]!) : null; db.update(schema.events).set({ assistId: a?.id ?? null }).where(eq(schema.events.id, g.id)).run(); console.log(`✓ ${g.minute}' assist: ${a ? `${a.name} ${a.surname}` : "—"}`); });
console.log("done", rows.length, "players,", goals.length, "goals");
