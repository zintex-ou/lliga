// Set shirt numbers: [playerId or "Surname", dorsal]
import { db, schema } from "../src/db";
import { eq, and, like } from "drizzle-orm";

const TEAM = "cf-fogars-veterans";
const DORSALS: [number | string, number][] = [[1076, 88], ["Errouchani", 11], [1079, 24]];

const team = db.select().from(schema.teams).where(eq(schema.teams.slug, TEAM)).get()!;
for (const [who, n] of DORSALS) {
  const p = typeof who === "number"
    ? db.select().from(schema.players).where(eq(schema.players.id, who)).get()
    : db.select().from(schema.players).where(and(eq(schema.players.teamId, team.id), like(schema.players.surname, `%${who}%`))).get();
  if (!p) { console.log("✗ no player", who); continue; }
  db.update(schema.players).set({ dorsal: n }).where(eq(schema.players.id, p.id)).run();
  console.log(`✓ ${p.name} ${p.surname} → #${n}`);
}
