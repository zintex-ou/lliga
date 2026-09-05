import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { getGroupsAdmin, loadGroup } from "@/lib/stats";

export type RefStats = { referee: typeof schema.referees.$inferSelect; matches: number; avgRating: number | null; ratings: number; yellowsPerMatch: number; redsPerMatch: number; yellows: number; reds: number };

/** Public statistics of a referee for the active season: matches directed, average delegate rating, cards per match. */
export const refereeStats = cache((refereeId: number): RefStats | null => {
  const referee = db.select().from(schema.referees).where(eq(schema.referees.id, refereeId)).get();
  if (!referee) return null;
  const played = getGroupsAdmin().flatMap((g) => loadGroup(g.id, true).matches.filter((m) => m.refereeId === refereeId && (m.status === "played" || m.status === "walkover") && m.published));
  const ids = played.map((m) => m.id);
  const evs = ids.length ? db.select().from(schema.events).where(inArray(schema.events.matchId, ids)).all() : [];
  const yellows = evs.filter((e) => e.type === "groga" || e.type === "segona_groga").length;
  const reds = evs.filter((e) => e.type === "vermella" || e.type === "segona_groga").length;
  const ratings = db.select().from(schema.refereeRatings).where(eq(schema.refereeRatings.refereeId, refereeId)).all();
  const n = played.length;
  return { referee, matches: n, ratings: ratings.length, avgRating: ratings.length ? ratings.reduce((a, r) => a + r.score, 0) / ratings.length : null, yellows, reds, yellowsPerMatch: n ? yellows / n : 0, redsPerMatch: n ? reds / n : 0 };
});
