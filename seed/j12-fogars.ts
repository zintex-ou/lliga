// J12 (21 Nov 2026): CF Fogars Veterans won 4-0 — result, goals, lineup. Re-runnable.
import { db, schema } from "../src/db";
import { eq, and, inArray } from "drizzle-orm";

const ROUND = 12, OURS = 4, THEIRS = 0;
const GOALS: [string, "gol" | "gol_pen", number | null, string | null][] = [
  ["Delyhonny", "gol", 13, "Andreev"],
  ["Oscar Balleste", "gol", 31, "Jhoan"],
  ["Cuerva", "gol", 53, "Coloma"],
  ["Hlot", "gol", 63, "Coloma"],
];
const TITULARS = ["Zinchenko", "Stoiachenko", "Delgado", "Hlot", "Jhoan", "Coloma", "Miquel Balleste", "Andreev", "Oscar Balleste", "Delyhonny", "Cuerva"];
const SUPLENTS = ["Segui", "Zelenov", "Ignatov", "Errouchani", "Ezequiel"]; // all entered
const CONCEDED: Record<string, number> = { Zinchenko: 0 };

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
const find = (frag: string) => { const h = squad.filter((x) => norm(`${x.name} ${x.surname}`).includes(norm(frag))); if (h.length !== 1) { console.log(`✗ ${frag}: ${h.length} matches (${h.map((p) => `${p.name} ${p.surname}`).join(", ")})`); return null; } return h[0]; };

const del = db.delete(schema.events).where(and(eq(schema.events.matchId, m.id), inArray(schema.events.type, ["gol", "gol_pen"]))).run();
console.log("removed goal events:", del.changes);
GOALS.forEach(([who, type, minute, asst], i) => {
  const p = find(who); if (!p) return;
  const a = asst ? find(asst) : null;
  db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type, minute, assistId: a?.id ?? null, sort: i }).run();
  console.log("✓", minute, `${p.name} ${p.surname}`, type, a ? `(${a.name} ${a.surname})` : "");
});

const rows = [...TITULARS.map((f) => ({ f, role: "titular" })), ...SUPLENTS.map((f) => ({ f, role: "suplent" }))].map((x) => ({ ...x, p: find(x.f) })).filter((x) => x.p);
db.delete(schema.appearances).where(and(eq(schema.appearances.matchId, m.id), inArray(schema.appearances.playerId, squad.map((p) => p.id)))).run();
for (const r of rows) { db.insert(schema.appearances).values({ matchId: m.id, playerId: r.p!.id, role: r.role, entered: true, conceded: CONCEDED[r.f] ?? null }).run(); console.log(`✓ ${r.role === "titular" ? "T" : "S"} ${r.p!.name} ${r.p!.surname}`); }
console.log(`done: ${home ? OURS : THEIRS}-${home ? THEIRS : OURS}, ${rows.length} players`);
