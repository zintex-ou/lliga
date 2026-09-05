/* Idempotent update for an existing database: president accounts + contact page text. */
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
export const CONTACT = `Comitè Organitzador · 972 204 640 · jaumemonegros@hotmail.com
Comitè de Competició · Pepe Muñoz · 696 675 831 · mu_sol@hotmail.com
Col·legi d'Àrbitres · Miguel Ramírez Sanz · 600 671 913 · lilosuna68@hotmail.com`;
const now = new Date().toISOString();
for (const u of [
  { email: "president@lliga.local", name: "President de la lliga", pw: "president1234", role: "president_lliga" },
  { email: "arbitres@lliga.local", name: "President del comitè d'àrbitres", pw: "arbitres1234", role: "president_arbitres" },
]) {
  if (db.select().from(schema.users).where(eq(schema.users.email, u.email)).get()) { console.log(u.email, "ja existeix"); continue; }
  db.insert(schema.users).values({ email: u.email, name: u.name, passwordHash: bcrypt.hashSync(u.pw, 10), role: u.role, createdAt: now }).run();
  console.log("creat", u.email, "/", u.pw);
}
const page = db.select().from(schema.pages).where(eq(schema.pages.slug, "contacte")).get();
if (page && (!page.body || !page.body.includes("Miguel"))) { db.update(schema.pages).set({ body: CONTACT }).where(eq(schema.pages.slug, "contacte")).run(); console.log("contacte omplert"); }
