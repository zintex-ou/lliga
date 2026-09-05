/* Import team data (delegates, field, kit, team photo) from the old site futbolempresesgirona.com.
   Run inside the app container:  node node_modules/tsx/dist/cli.mjs seed/import-oldsite.ts
   Idempotent: fills only empty fields, replaces placeholder delegates, adds each photo once. */
import { db, schema, UPLOAD_DIR } from "../src/db";
import { eq, and, like } from "drizzle-orm";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PAGES = [
  "https://www.futbolempresesgirona.com/index.php/dades-dels-equips/",
  "https://www.futbolempresesgirona.com/index.php/dadas-dels-equipo-grup-b/",
];
const MIN_PHOTO = 2023 * 100 + 8; // only photos uploaded from season 2023-24 on
const ALIASES: Record<string, string> = {
  "veterans sporting vidrerenca": "vet-sporting-vidrerenca",
  "angles huellas de colombia": "angles-huellas-colombia",
  "coma cros c la h": "comacros-c-la-h",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["veterans", "veterans", "vet", "veteranos", "fc", "ce", "cf", "ue", "ef", "cef", "ae", "de", "d", "la", "el", "els", "club", "esportiu", "ath", "athletic", "atletic", "atletico"]);
const core = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w)).join(" ");
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

type Old = { name: string; delegat?: string; segon?: string; camp?: string; kit?: string; img?: string };

function parse(html: string): Old[] {
  const out: Old[] = [];
  const parts = html.split(/<h2[^>]*>/i).slice(1);
  for (const part of parts) {
    const h2end = part.indexOf("</h2>");
    const name = strip(part.slice(0, h2end));
    if (!name || name.length > 60) continue;
    const body = part.slice(h2end);
    const t: Old = { name };
    for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const txt = strip(m[1]);
      const mm = txt.match(/^([^:]{3,25}):\s*(.*)$/);
      if (!mm) continue;
      const label = norm(mm[1]), val = mm[2].trim();
      if (label === "delegat") t.delegat = val;
      else if (label.startsWith("segon d") || label.startsWith("2n d")) t.segon = val;
      else if (label === "camp") t.camp = val;
      else if (label.startsWith("indument")) t.kit = val;
      else if (/^(segona|tercera|2a|3a) equipaci/.test(label)) t.kit = `${t.kit ? t.kit + ". " : ""}${mm[1].trim()}: ${val}`;
    }
    const img = body.match(/<img[^>]+src="([^"]+)"/i);
    if (img) t.img = img[1];
    out.push(t);
  }
  return out;
}

function person(s: string | undefined) {
  if (!s) return null;
  const email = s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phone = s.match(/\b\d{3}[ .]?\d{3}[ .]?\d{3}\b/)?.[0]?.replace(/[ .]/g, "") ?? null;
  const name = s.split(/[,;]|Telf|Tel\.|e-mail/i)[0].replace(/\s+/g, " ").trim();
  return name ? { name, phone, email } : null;
}

async function photo(url: string, slug: string): Promise<{ file: string; season: string } | null> {
  const ym = url.match(/uploads\/(\d{4})\/(\d{2})\//);
  if (!ym) return null;
  const y = Number(ym[1]), m = Number(ym[2]);
  if (y * 100 + m < MIN_PHOTO) return null;
  const season = m >= 8 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  const orig = url.replace(/-\d{3,4}x\d{3,4}(\.\w+)$/, "$1");
  let buf: Buffer | null = null;
  for (const u of [orig, url]) {
    try { const r = await fetch(u); if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); break; } } catch { /* try next */ }
  }
  if (!buf) return null;
  const dir = path.join(UPLOAD_DIR, "photo"); fs.mkdirSync(dir, { recursive: true });
  const file = `photo/team-${slug}-${season}.jpg`;
  await sharp(buf).rotate().resize(1400, 1000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(UPLOAD_DIR, file));
  return { file, season };
}

async function main() {
  const teams = db.select().from(schema.teams).all();
  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const byCore = new Map(teams.map((t) => [core(t.name), t]));
  const olds: Old[] = [];
  for (const p of PAGES) { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); olds.push(...parse(await r.text())); }
  console.log(`Old site: ${olds.length} teams`);
  const unmatched: string[] = [];
  for (const o of olds) {
    const k = norm(o.name);
    let team = ALIASES[k] ? bySlug.get(ALIASES[k]) : byCore.get(core(o.name));
    if (!team) { const c = core(o.name); team = teams.find((t) => core(t.name).includes(c) || c.includes(core(t.name))); }
    if (!team) { unmatched.push(o.name); continue; }
    const upd: Partial<typeof team> = {};
    if (o.camp) {
      const m = o.camp.match(/^([^(]+)\(([^)]+)\)/);
      if (!team.field) upd.field = (m ? m[1] : o.camp).trim();
      if (m && !team.info) upd.info = `Camp: ${o.camp}`;
    }
    if (o.kit && team.colors !== o.kit) upd.colors = o.kit;
    if (o.img && !team.photo) {
      const ph = await photo(o.img, team.slug);
      if (ph) {
        upd.photo = ph.file;
        const key = team.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const exists = db.select().from(schema.teamPhotos).where(and(eq(schema.teamPhotos.teamKey, key), eq(schema.teamPhotos.file, ph.file))).get();
        if (!exists) db.insert(schema.teamPhotos).values({ teamKey: key, season: ph.season, file: ph.file, caption: "Foto de l'equip" }).run();
      }
    }
    if (Object.keys(upd).length) db.update(schema.teams).set(upd).where(eq(schema.teams.id, team.id)).run();
    // delegates: drop placeholders, add real ones if not present
    db.delete(schema.staff).where(and(eq(schema.staff.teamId, team.id), like(schema.staff.name, "Delegat %"))).run();
    db.delete(schema.staff).where(and(eq(schema.staff.teamId, team.id), like(schema.staff.name, "samarreta%"))).run(); // earlier mis-parse
    const cur = db.select().from(schema.staff).where(eq(schema.staff.teamId, team.id)).all();
    let sort = cur.length;
    for (const p of [person(o.delegat), person(o.segon)]) {
      if (!p) continue;
      const same = cur.find((s) => norm(s.name) === norm(p.name));
      if (same) { db.update(schema.staff).set({ phone: same.phone ?? p.phone, email: same.email ?? p.email }).where(eq(schema.staff.id, same.id)).run(); continue; }
      db.insert(schema.staff).values({ teamId: team.id, name: p.name, role: "delegat", phone: p.phone, email: p.email, sort: sort++ }).run();
    }
    console.log(`✓ ${o.name} → ${team.name}${upd.photo ? " (foto)" : ""}`);
  }
  // club crests shipped with the repo (seed/<slug>-logo.png)
  for (const t of teams) {
    const src = path.join(__dirname, `${t.slug}-logo.png`);
    if (!fs.existsSync(src) || t.logo) continue;
    fs.mkdirSync(path.join(UPLOAD_DIR, "logo"), { recursive: true });
    const file = `logo/t${t.id}-seed.png`;
    await sharp(src).resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(UPLOAD_DIR, file));
    db.update(schema.teams).set({ logo: file }).where(eq(schema.teams.id, t.id)).run();
    console.log(`✓ escut ${t.name}`);
  }
  if (unmatched.length) console.log(`\nNo match (old site team not in 2026-27 or renamed): ${unmatched.join(" | ")}`);
  const noData = teams.filter((t) => !olds.some((o) => (ALIASES[norm(o.name)] === t.slug) || core(o.name) === core(t.name) || core(o.name).includes(core(t.name)) || core(t.name).includes(core(o.name))));
  if (noData.length) console.log(`Teams without old-site data: ${noData.map((t) => t.name).join(" | ")}`);
}
main();
