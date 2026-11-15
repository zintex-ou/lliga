// J11 Can Borell 0-6 CF Fogars: lineup. Re-runnable (replaces Fogars appearances for the match).
import { db, schema } from "../src/db";
import { eq, and, inArray } from "drizzle-orm";

const ROUND = 11;
const TITULARS = ["Zinchenko", "Stoiachenko", "Farafontov", "Delgado", "Jhoan", "Miquel Balleste", "Coloma", "Andreev", "Oscar Balleste", "Zamora", "Franco Rodriguez"];
const SUPLENTS = ["Lopez Fernandez", "Cuerva", "Hlot", "Segui", "Errouchani", "Tiurin", "Ignatov", "Ortiz"]; // all entered
const CONCEDED: Record<string, number> = { Zinchenko: 0, "Lopez Fernandez": 0 };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fog = db.select().from(schema.teams).all().find((t) => /fogars/i.test(t.name))!;
const round = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, fog.groupId), eq(schema.rounds.number, ROUND))).get()!;
const m = db.select().from(schema.matches).where(eq(schema.matches.roundId, round.id)).all().find((x) => x.homeId === fog.id || x.awayId === fog.id);
if (!m) throw new Error("match not found");
const squad = db.select().from(schema.players).where(eq(schema.players.teamId, fog.id)).all();
const find = (frag: string) => { const h = squad.filter((p) => norm(`${p.name} ${p.surname}`).includes(norm(frag))); if (h.length !== 1) { console.log(`✗ ${frag}: ${h.length} matches (${h.map((p) => `${p.name} ${p.surname}`).join(", ")})`); return null; } return h[0]; };
const rows = [...TITULARS.map((f) => ({ f, role: "titular" })), ...SUPLENTS.map((f) => ({ f, role: "suplent" }))].map((x) => ({ ...x, p: find(x.f) })).filter((x) => x.p);
db.delete(schema.appearances).where(and(eq(schema.appearances.matchId, m.id), inArray(schema.appearances.playerId, squad.map((p) => p.id)))).run();
for (const r of rows) { db.insert(schema.appearances).values({ matchId: m.id, playerId: r.p!.id, role: r.role, entered: true, conceded: CONCEDED[r.f] ?? null }).run(); console.log(`✓ ${r.role === "titular" ? "T" : "S"} ${r.p!.name} ${r.p!.surname}`); }
console.log("done", rows.length, "players");
