import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { vapidPublicKey } from "@/lib/push";

export async function GET() { return NextResponse.json({ key: vapidPublicKey() }); }

/** body: { subscription, team?: string (team name), group?: string, lang?: string, unsubscribe?: boolean } */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const sub = b?.subscription; if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "bad" }, { status: 400 });
  if (b.unsubscribe) { db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, sub.endpoint)).run(); return NextResponse.json({ ok: true }); }
  const teamKeyVal = b.team ? String(b.team).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-") : null;
  const row = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, teamKey: teamKeyVal, groupName: b.group ? String(b.group).toUpperCase() : null, lang: b.lang === "es" ? "es" : "ca", createdAt: new Date().toISOString() };
  db.insert(schema.pushSubscriptions).values(row).onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: row }).run();
  return NextResponse.json({ ok: true });
}
