// Set goal minutes for one match: MATCH_ID and list of [playerId, minute] in chronological order.
import { db, schema } from "../src/db";
import { eq, and } from "drizzle-orm";

const MATCH_ID = 365; // J7 Veterans Sant Antoni 2-2 CF Fogars Veterans
const MINUTES: [number, number][] = [[879, 24], [542, 31], [549, 61], [879, 75]];

const evs = db.select().from(schema.events).where(and(eq(schema.events.matchId, MATCH_ID), eq(schema.events.type, "gol"))).all();
const used = new Set<number>();
MINUTES.forEach(([pid, min], i) => {
  const e = evs.find((x) => x.playerId === pid && !used.has(x.id));
  if (!e) { console.log("no event for", pid); return; }
  used.add(e.id);
  db.update(schema.events).set({ minute: min, sort: i }).where(eq(schema.events.id, e.id)).run();
  console.log("✓", pid, min);
});
