/* Import the printable documents from the old site into Normatives → Documentació.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/import-docs.ts   (idempotent by title) */
import { db, schema, UPLOAD_DIR } from "../src/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.futbolempresesgirona.com/wp-content/uploads/";
const DOCS: [string, string, string][] = [ // title, url, note
  ["Fitxa de jugador veterà", BASE + "2021/04/fitxa-blanca.pdf", "Fitxa blanca"],
  ["Fitxa de jugador no veterà", BASE + "2021/04/fitxa-blava.pdf", "Fitxa blava"],
  ["Declaració responsable — equip local", BASE + "2021/04/DECLARACIO-RESPONSABLE-LOCAL.pdf", ""],
  ["Declaració responsable — equip visitant", BASE + "2021/04/DECLARACIO-RESPONSABLE-VISITANT.pdf", ""],
  ["Full de sol·licitud d'inscripció", BASE + "2023/06/FULL-INSCRIPCIO-23-24.pdf", "Temporada 2023-24 (pendent d'actualitzar)"],
];

async function main() {
  fs.mkdirSync(path.join(UPLOAD_DIR, "docs"), { recursive: true });
  let sort = 0;
  for (const [title, url, note] of DOCS) {
    sort++;
    if (db.select().from(schema.documents).where(eq(schema.documents.title, title)).get()) { console.log(`· ${title}: ja existeix`); continue; }
    const r = await fetch(url);
    if (!r.ok) { console.log(`✗ ${title}: HTTP ${r.status}`); continue; }
    const name = `docs/${path.basename(new URL(url).pathname)}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await r.arrayBuffer()));
    db.insert(schema.documents).values({ title, category: "documentacio", file: name, body: note || null, sort }).run();
    console.log(`✓ ${title}`);
  }
}
main();
