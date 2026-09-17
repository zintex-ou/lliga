import { NextResponse } from "next/server";
import { db, schema, UPLOAD_DIR } from "@/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

/* One-off helper: receive a club crest as a data: URL from a browser tab (fetched from a site that blocks our server IP).
   Protected by CREST_TOKEN env; disabled when the variable is unset. */
const ORIGIN = "*";
const cors = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors }); }

export async function POST(req: Request) {
  const token = process.env.CREST_TOKEN;
  if (!token) return NextResponse.json({ error: "disabled" }, { status: 404, headers: cors });
  const b = await req.json().catch(() => null) as { token?: string; slug?: string; dataUrl?: string } | null;
  if (!b || b.token !== token) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: cors });
  const t = b.slug ? db.select().from(schema.teams).where(eq(schema.teams.slug, b.slug)).get() : null;
  const m = b.dataUrl?.match(/^data:image\/[\w+.-]+;base64,(.+)$/);
  if (!t || !m) return NextResponse.json({ error: "bad request" }, { status: 400, headers: cors });
  fs.mkdirSync(path.join(UPLOAD_DIR, "logo"), { recursive: true });
  const file = `logo/t${t.id}-web.png`;
  await sharp(Buffer.from(m[1], "base64")).resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(UPLOAD_DIR, file));
  db.update(schema.teams).set({ logo: file }).where(eq(schema.teams.id, t.id)).run();
  return NextResponse.json({ ok: true, team: t.name, file }, { headers: cors });
}
