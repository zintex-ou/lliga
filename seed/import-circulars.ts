/* Register circular PDFs dropped into <DATA_DIR>/uploads/docs/inbox/ (names like "00001.Circular 20 setembre 2025.pdf").
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/import-circulars.ts
   Renames to docs/circular-YYYY-MM-DD.pdf, title "Circular 20 setembre 2025", note "Temporada 2025-26". Idempotent. */
import { db, schema, UPLOAD_DIR } from "../src/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const MONTHS: Record<string, number> = { gener: 1, febrer: 2, marc: 3, març: 3, abril: 4, maig: 5, juny: 6, juliol: 7, agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12 };
const inbox = path.join(UPLOAD_DIR, "docs", "inbox");
if (!fs.existsSync(inbox)) { console.log(`No inbox folder: ${inbox}`); process.exit(0); }

let n = 0;
for (const f of fs.readdirSync(inbox).sort()) {
  if (!/\.pdf$/i.test(f)) continue;
  const m = f.normalize("NFC").match(/Circular\s+(\d{1,2})\s+([a-zç]+)\s+(\d{4})/i);
  if (!m) { console.log(`? no date in name: ${f}`); continue; }
  const d = Number(m[1]), mon = MONTHS[m[2].toLowerCase()], y = Number(m[3]);
  if (!mon) { console.log(`? unknown month: ${f}`); continue; }
  const monthName = Object.keys(MONTHS).find((k) => MONTHS[k] === mon && k !== "marc")!;
  const title = `Circular ${d} ${monthName} ${y}`;
  const season = mon >= 8 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  const iso = `${y}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dest = `docs/circular-${iso}.pdf`;
  if (db.select().from(schema.documents).where(eq(schema.documents.title, title)).get()) { fs.unlinkSync(path.join(inbox, f)); console.log(`· ${title}: duplicat, saltat`); continue; }
  fs.renameSync(path.join(inbox, f), path.join(UPLOAD_DIR, dest));
  db.insert(schema.documents).values({ title, category: "circulars", file: dest, body: `Temporada ${season}`, sort: Number(iso.replace(/-/g, "")) }).run();
  n++; console.log(`✓ ${title} (${season})`);
}
console.log(`${n} circulars afegides`);
