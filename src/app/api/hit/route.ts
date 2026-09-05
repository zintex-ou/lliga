import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";

/** Page-view beacon. Aggregates per day+path; "visitors" counts distinct daily hashes (IP+UA, rotated daily, never stored raw). */
const seen = new Map<string, Set<string>>(); // day -> hashes (in-memory, resets on restart — good enough for a league site)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  let path = String(body?.path || "/").split("?")[0].slice(0, 120);
  if (path.startsWith("/admin") || path.startsWith("/api")) return NextResponse.json({ ok: true });
  path = path.replace(/^\/(jugador|partit)\/\d+.*/, "/$1/*");
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0"; const ua = req.headers.get("user-agent") || "";
  const h = createHash("sha256").update(`${day}|${ip}|${ua}`).digest("hex").slice(0, 16);
  if (!seen.has(day)) { seen.clear(); seen.set(day, new Set()); }
  const isNew = !seen.get(day)!.has(h + "|" + path); seen.get(day)!.add(h + "|" + path);
  db.insert(schema.visits).values({ day, path, views: 1, visitors: isNew ? 1 : 0 })
    .onConflictDoUpdate({ target: [schema.visits.day, schema.visits.path], set: { views: sql`${schema.visits.views} + 1`, visitors: sql`${schema.visits.visitors} + ${isNew ? 1 : 0}` } }).run();
  return NextResponse.json({ ok: true });
}
