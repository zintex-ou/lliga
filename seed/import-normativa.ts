/* Idempotent: fills the Normativa veterans and Reglament pages with the texts from the old website (only if empty). */
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
for (const [slug, file] of [["normativa", "normativa.txt"], ["reglament", "reglament.txt"]] as const) {
  const body = fs.readFileSync(path.join(__dirname, file), "utf8").trim();
  const page = db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).get();
  if (page && !page.body) { db.update(schema.pages).set({ body }).where(eq(schema.pages.slug, slug)).run(); console.log(slug, "omplert"); } else console.log(slug, "ja tenia text — no s'ha tocat");
}
