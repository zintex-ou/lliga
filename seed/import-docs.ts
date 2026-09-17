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

// last season's circulars (old site) — kept as history
const CIRC = ["2025/09/00001.Circular-20-setembre-2025.pdf", "2025/09/00001.Circular-27-setembre-2025.pdf", "2025/10/00001.Circular-4-octubre-2025.pdf", "2025/10/00001.Circular-11-octubre-2025.pdf", "2025/10/00001.Circular-18-octubre-2025.pdf", "2025/10/00001.Circular-25-octubre-2025.pdf", "2025/11/00001.Circular-1-novembre-2025.pdf", "2025/11/00001.Circular-8-novembre-2025.pdf", "2025/11/00001.Circular-15-novembre-2025.pdf", "2025/11/00001.Circular-22-novembre-2025.pdf", "2025/11/00001.Circular-29-novembre-2025.pdf", "2025/12/00001.Circular-13-desembre-2025.pdf", "2025/12/00001.Circular-20-desembre-2025.pdf", "2026/01/00001.Circular-10-gener-2026.pdf", "2026/01/00001.Circular-17-gener-2026.pdf", "2026/01/00001.Circular-24-gener-2026.pdf", "2026/02/00001.Circular-31-gener-2026.pdf", "2026/02/00001.Circular-7-febrer-2026.pdf", "2026/02/00001.Circular-21-febrer-2026.pdf", "2026/03/00001.Circular-28-febrer-2026.pdf", "2026/03/00001.Circular-7-marc-2026.pdf", "2026/03/00001.Circular-14-marc-2026.pdf", "2026/03/00001.Circular-21-marc-2026.pdf", "2026/03/00001.Circular-28-marc-2026.pdf", "2026/04/00001.Circular-11-abril-2026.pdf", "2026/04/00001.Circular-18-abril-2026.pdf", "2026/04/00001.Circular-25-abril-2026.pdf", "2026/05/00001.Circular-2-maig-2026.pdf", "2026/05/00001.Circular-9-maig-2026.pdf", "2026/05/00001.Circular-16-maig-2026.pdf", "2026/05/00001.Circular-23-maig-2026.pdf", "2026/05/00001.Circular-30-maig-2026.pdf", "2026/06/00001.Circular-6-juny-2026.pdf", "2026/06/00001.Circular-13-juny-2026.pdf", "2025/06/00001.Circular-21-juny-2025.pdf"];

async function main() {
  fs.mkdirSync(path.join(UPLOAD_DIR, "docs"), { recursive: true });
  let c = 0;
  for (const rel of CIRC) {
    c++;
    const m = rel.match(/Circular-(\d+)-([a-z]+)-(\d{4})/)!;
    const mon = m[2].replace("marc", "març");
    const title = `Circular ${m[1]} ${mon} ${m[3]}`;
    if (db.select().from(schema.documents).where(eq(schema.documents.title, title)).get()) continue;
    const r = await fetch(BASE + rel);
    if (!r.ok) { console.log(`✗ ${title}: HTTP ${r.status}`); continue; }
    const name = `docs/circular-${m[3]}-${m[2]}-${m[1].padStart(2, "0")}.pdf`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await r.arrayBuffer()));
    db.insert(schema.documents).values({ title, category: "circulars", file: name, body: "Temporada 2025-26", sort: c }).run();
    console.log(`✓ ${title}`);
  }
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
