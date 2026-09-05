import { NextRequest, NextResponse } from "next/server";
/** Remember the visitor's group; redirects back (or to ?to=). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ g: string }> }) {
  const { g } = await params;
  const to = req.nextUrl.searchParams.get("to") || req.headers.get("referer") || "/";
  const res = NextResponse.redirect(new URL(to, req.url));
  res.cookies.set("grp", g.toUpperCase() === "B" ? "B" : "A", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
