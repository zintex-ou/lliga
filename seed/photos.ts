// Player portraits from seed/portraits/<Name>.jpg → player.photo (CF Fogars Veterans). Re-runnable.
// Run inside the container: node node_modules/tsx/dist/cli.mjs seed/photos.ts
import { db, schema, UPLOAD_DIR } from "../src/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const TEAM = /fogars/i;
/** file stem → name fragment to match (defaults to the stem itself) */
const MAP: Record<string, string> = { Abdelaziz: "Errouchani", Ievgen: "Zinchenko", Francisco: "Segui", Lopez: "Lopez Fernandez", Miquel: "Miquel Balleste", Oscar: "Oscar Balleste", Zamora: "Zamora", Jhoan: "Jhoan", Ezequiel: "Ezequiel", Karim: "Karim", Clarke: "Clarke", Rubanov: "Rubanov" };
const SKIP = new Set(["Padaliuk"]); // coach — on the club site only

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const team = db.select().from(schema.teams).all().find((t) => TEAM.test(t.name))!;
const squad = db.select().from(schema.players).where(eq(schema.players.teamId, team.id)).all();
const dir = path.join(process.cwd(), "seed", "portraits");
fs.mkdirSync(path.join(UPLOAD_DIR, "photo"), { recursive: true });

async function main() {
  for (const f of fs.readdirSync(dir).filter((x) => /\.(jpe?g|png)$/i.test(x)).sort()) {
    const stem = f.replace(/\.[^.]+$/, "");
    if (SKIP.has(stem)) continue;
    const frag = norm(MAP[stem] ?? stem);
    const hits = squad.filter((p) => norm(`${p.name} ${p.surname}`).includes(frag) || norm(`${p.surname} ${p.name}`).includes(frag));
    if (hits.length !== 1) { console.log(`✗ ${stem}: ${hits.length} matches (${hits.map((p) => `${p.name} ${p.surname}`).join(", ")})`); continue; }
    const p = hits[0];
    const out = `photo/p${p.id}.jpg`;
    await sharp(path.join(dir, f)).resize(600, 600, { fit: "cover" }).jpeg({ quality: 86 }).toFile(path.join(UPLOAD_DIR, out));
    db.update(schema.players).set({ photo: out }).where(eq(schema.players.id, p.id)).run();
    console.log(`✓ ${p.name} ${p.surname} ← ${f}`);
  }
}
main();
