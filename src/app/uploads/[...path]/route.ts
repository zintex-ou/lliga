import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/db";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf", ".svg": "image/svg+xml" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const rel = path.normalize(parts.join("/"));
  if (rel.startsWith("..")) return new Response("Not found", { status: 404 });
  const file = path.join(UPLOAD_DIR, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  return new Response(fs.readFileSync(file), { headers: { "content-type": type, "cache-control": "public, max-age=86400" } });
}
