// Merge explicitly named typo-players into their twins (same squad). Prints what it does; keeps unmatched ones.
import { db, schema } from "../src/db";
import { eq, like } from "drizzle-orm";
const NAMES = ["Catovic Audic", "Arruenes", "Duarte Triana", "Makfaoui", "Sefan", "Sidebeh", "Kilou", "el Yousseefi", "Oliink", "Bernítez", "Croft Spencer", "Dúaz Cherrato", "Arjaz"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function sim(a: string, b: string) { const bg = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) ?? 0) + 1); } return m; }; const A = bg(a), B = bg(b); let n = 0; for (const [k, v] of A) n += Math.min(v, B.get(k) ?? 0); return (2 * n) / (a.length - 1 + b.length - 1 || 1); }
for (const q of NAMES) {
  const p = db.select().from(schema.players).where(like(schema.players.surname, `%${q}%`)).all().sort((a, b) => b.id - a.id)[0];
  if (!p) { console.log(`✗ ${q}: not found`); continue; }
  const squad = db.select().from(schema.players).where(eq(schema.players.teamId, p.teamId)).all().filter((x) => x.id !== p.id && !/^Jugador /.test(x.surname));
  const f = norm(`${p.name} ${p.surname}`);
  const best = squad.map((x) => ({ x, s: Math.max(sim(norm(`${x.name} ${x.surname}`), f), sim(norm(`${x.surname} ${x.name}`), f), sim(norm(x.surname), norm(p.surname))) })).sort((a, b) => b.s - a.s)[0];
  const evs = db.select().from(schema.events).where(eq(schema.events.playerId, p.id)).all().length;
  if (best && best.s >= 0.6) {
    db.update(schema.events).set({ playerId: best.x.id }).where(eq(schema.events.playerId, p.id)).run();
    db.update(schema.events).set({ assistId: best.x.id }).where(eq(schema.events.assistId, p.id)).run();
    db.delete(schema.appearances).where(eq(schema.appearances.playerId, p.id)).run();
    db.delete(schema.players).where(eq(schema.players.id, p.id)).run();
    console.log(`✓ ${p.name} ${p.surname} → ${best.x.name} ${best.x.surname} (${best.s.toFixed(2)}, ${evs} events moved)`);
  } else console.log(`· kept ${p.name} ${p.surname} [${evs} events]  best: ${best ? `${best.x.name} ${best.x.surname} ${best.s.toFixed(2)}` : "-"}`);
}
