import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  const active = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get();
  const res = NextResponse.redirect(new URL("/", req.url));
  if (!id || id === active?.id) res.cookies.delete("season");
  else res.cookies.set("season", String(id), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
  return res;
}
