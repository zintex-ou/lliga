import { NextRequest, NextResponse } from "next/server";
/** Select a season to browse (archive). id "actual" clears the cookie. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = NextResponse.redirect(new URL(req.nextUrl.searchParams.get("to") || "/", req.url));
  if (id === "actual" || !Number(id)) res.cookies.delete("season");
  else res.cookies.set("season", String(Number(id)), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
  return res;
}
