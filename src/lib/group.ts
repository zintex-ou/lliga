import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getGroups, getGroupByName } from "@/lib/stats";

/** Resolve the group from a route param, falling back to the visitor's remembered group, then the first group. */
export async function resolveGroup(param?: string | string[]) {
  const p = Array.isArray(param) ? param[0] : param;
  if (p) { const g = getGroupByName(p); if (!g) notFound(); return g; }
  const c = (await cookies()).get("grp")?.value;
  return (c && getGroupByName(c)) || getGroups()[0];
}

export function parseRound(q: string | string[] | undefined, fallback: number, max: number) {
  const n = Number(Array.isArray(q) ? q[0] : q);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

/** Europe/Madrid weekday: 0=Sunday … 6=Saturday. Thu–Sat show the next round; Sun–Wed show results. */
export function showNextRound(now = new Date()) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(now);
  return wd === "Thu" || wd === "Fri" || wd === "Sat";
}
