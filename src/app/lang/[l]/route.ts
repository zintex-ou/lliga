import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest, { params }: { params: Promise<{ l: string }> }) {
  const { l } = await params;
  const back = req.headers.get("referer") || "/";
  const res = NextResponse.redirect(new URL(back, req.url));
  res.cookies.set("lang", l === "es" ? "es" : "ca", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
