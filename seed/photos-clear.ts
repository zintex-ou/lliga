// Remove portraits from CF Fogars players in the league DB (they live on the club site instead).
import { db, schema } from "../src/db";
import { eq, and, like } from "drizzle-orm";
const team = db.select().from(schema.teams).all().find((t) => /fogars/i.test(t.name))!;
const r = db.update(schema.players).set({ photo: null }).where(and(eq(schema.players.teamId, team.id), like(schema.players.photo, "photo/p%"))).run();
console.log("cleared", r.changes);
