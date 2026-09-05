import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "change-me-in-production-please-0123456789");
const COOKIE = "session";

export type Role = "admin" | "president_lliga" | "president_arbitres" | "delegat" | "arbitre" | "visitant";
export type SessionUser = { id: number; email: string; name: string; role: Role; teamId: number | null; refereeId: number | null };

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin", president_lliga: "President de la lliga", president_arbitres: "President del comitè d'àrbitres", delegat: "Delegat", arbitre: "Àrbitre", visitant: "Visitant",
};

export const canEditMatches = (r: Role) => r === "admin" || r === "president_lliga" || r === "president_arbitres";
export const canEditContent = canEditMatches;
export const isAdmin = (r: Role) => r === "admin";

export async function login(email: string, password: string) {
  const u = db.select().from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase())).get();
  if (!u || !u.active || !bcrypt.compareSync(password, u.passwordHash)) return false;
  const token = await new SignJWT({ id: u.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" });
  return true;
}
export async function logout() { (await cookies()).delete(COOKIE); }

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const u = db.select().from(schema.users).where(eq(schema.users.id, Number(payload.id))).get();
    if (!u || !u.active) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role as Role, teamId: u.teamId, refereeId: u.refereeId };
  } catch { return null; }
});

export async function requireUser(minimum: "any" | "content" | "admin" = "any") {
  const u = await getUser();
  if (!u) redirect("/admin/login");
  if (minimum === "content" && !canEditContent(u.role)) redirect("/admin");
  if (minimum === "admin" && !isAdmin(u.role)) redirect("/admin");
  return u;
}

export function audit(userId: number, entity: string, entityId: number | null, action: string) {
  db.insert(schema.auditLog).values({ userId, entity, entityId, action, at: new Date().toISOString() }).run();
}
