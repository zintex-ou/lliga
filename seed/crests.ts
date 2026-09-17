/* Provisional club crests (parent clubs' badges found on the web). Run inside the container:
   node node_modules/tsx/dist/cli.mjs seed/crests.ts
   Only fills teams without a crest; delegates can replace them in the admin. */
import { db, schema, UPLOAD_DIR } from "../src/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const LP = (id: string) => `https://www.lapreferente.com/imagenes/escudos/escudo-${id}`;
const CRESTS: Record<string, string> = {
  // Grup A
  "vet-sporting-vidrerenca": LP("6960.png"),
  "ue-comacros-veterans-a": "https://cdn.resfu.com/img_data/equipos/24262.png",
  "comacros-c-la-h": "https://cdn.resfu.com/img_data/equipos/24262.png",
  "ce-angles": LP("6970.jpg"),
  "ce-sant-hilari-font-vella": LP("3564.png"),
  "fvb-vilobi": LP("12613.jpg"),
  "atletico-empuriabrava": LP("9978.png"),
  "veterans-cf-sils": LP("11166.jpg"),
  "uce-celra": LP("6985.jpg"),
  "veterans-d-arbucies": LP("6983.jpg"),
  "veterans-pontenc": LP("10969.png"),
  "sabat-veterans": "https://irp.cdn-website.com/53ac3a51/dms3rep/multi/opt/girones-sabat+1-1920w.png",
  "veterans-la-batlloria": LP("11167.jpg"),
  // Grup B
  "esportiu-bonmati": LP("12482.jpg"),
  "veterans-sant-antoni": LP("6971.jpg"),
  "fc-palafrugell-veterans": LP("6951.png"),
  "veterans-ath-hostalric": LP("14496.png"),
  "ef-macanet": LP("9790.jpg"),
  "veterans-ce-farners": LP("12480.png"),
  "racing-blanenc-b": LP("12473.jpg"),
  "cf-torderenc": LP("6198.png"),
  "veterans-cf-lloret": LP("3513.png"),
};

async function main() {
  fs.mkdirSync(path.join(UPLOAD_DIR, "logo"), { recursive: true });
  for (const [slug, url] of Object.entries(CRESTS)) {
    const t = db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).get();
    if (!t) { console.log(`✗ no team ${slug}`); continue; }
    if (t.logo) { console.log(`· ${t.name}: ja té escut`); continue; }
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (lliga veterans girona)", Accept: "image/*" } });
      if (!r.ok) { console.log(`✗ ${t.name}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const file = `logo/t${t.id}-web.png`;
      await sharp(buf).resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(UPLOAD_DIR, file));
      db.update(schema.teams).set({ logo: file }).where(eq(schema.teams.id, t.id)).run();
      console.log(`✓ ${t.name}`);
    } catch (e) { console.log(`✗ ${t.name}: ${(e as Error).message}`); }
  }
}
main();
