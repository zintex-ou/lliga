/* Seed: season 2026-27, both groups, real calendars, CF Fogars squad, placeholder squads, admin user. */
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const TOWNS: Record<string, string> = {
  "Vet. Sporting Vidrerenca": "Vidreres", "Real Guíxols FC": "Sant Feliu de Guíxols", "UE Comacros Veterans A": "Girona",
  "Inter Lloret": "Lloret de Mar", "CE Anglès": "Anglès", "CE Sant Hilari-Font Vella": "Sant Hilari Sacalm",
  "Anglès Huellas Colombia": "Anglès", "FVB Vilobí": "Vilobí d'Onyar", "Atlético Empuriabrava": "Empuriabrava",
  "Veterans CF Sils": "Sils", "UCE Celrà": "Celrà", "Comacros C - La H": "Girona", "Veterans d'Arbúcies": "Arbúcies",
  "Veteranos El Barrio": "Girona", "Veterans Pontenc": "Pont Major", "Sàbat Veterans": "Girona", "Majestic FC": "Girona",
  "Veterans La Batllòria": "La Batllòria",
  "Esportiu Bonmatí": "Bonmatí", "Bar Moreda": "Girona", "Veterans Sant Antoni": "Sant Antoni de Calonge",
  "FC Palafrugell Veterans": "Palafrugell", "Veterans Ath. Hostalric": "Hostalric", "Athlètic Can Borell": "Can Borell",
  "Veterans San Andrés": "Girona", "CE l'Aigüeta": "L'Aigüeta", "EF Maçanet": "Maçanet de la Selva",
  "Veterans CE Farners": "Santa Coloma de Farners", "Racing Blanenc B": "Blanes", "CF Torderenc": "Tordera",
  "Veterans CF Lloret": "Lloret de Mar", "FC Honduras Figueres": "Figueres", "CEF Veterans SFG": "Sant Feliu de Guíxols",
  "CF Fogars Veterans": "Fogars de la Selva", "Veterans Bordils-Flaçà": "Bordils", "Veterans Alt Empordà": "Figueres",
};

async function main() {
  const existing = db.select().from(schema.seasons).all();
  if (existing.length) { console.log("Already seeded (use `npm run reseed` to start from scratch)"); return; }

  const [season] = db.insert(schema.seasons).values({ name: "2026-27", active: true }).returning().all();
  const now = new Date().toISOString();

  for (const g of ["A", "B"] as const) {
    const cal = JSON.parse(fs.readFileSync(path.join(__dirname, `calendar${g}.json`), "utf8"));
    const [group] = db.insert(schema.groups).values({
      seasonId: season.id, name: g,
      topSlots: g === "A" ? 1 : 2, relegSlots: g === "A" ? 2 : 1, topLabel: g === "A" ? "campio" : "ascens",
    }).returning().all();

    const names: string[] = Array.from(new Set(cal.rounds[0].matches.flatMap((m: { home: string; away: string }) => [m.home, m.away])));
    const teamId: Record<string, number> = {};
    for (const n of names) {
      const [t] = db.insert(schema.teams).values({ groupId: group.id, name: n, slug: slugify(n), town: TOWNS[n] ?? null }).returning().all();
      teamId[n] = t.id;
      // placeholder squad or the real Fogars squad
      if (n === "CF Fogars Veterans") {
        const sq = JSON.parse(fs.readFileSync(path.join(__dirname, "fogars.json"), "utf8"));
        db.insert(schema.players).values(sq.map((p: { surname: string; name: string; dob: string; position: string; dorsal: number }) => ({
          teamId: t.id, surname: p.surname, name: p.name, dob: p.dob, position: p.position, dorsal: p.dorsal, registeredAt: "2026-09-01",
        }))).run();
        db.insert(schema.staff).values([
          { teamId: t.id, name: "Ievgen Zinchenko", role: "delegat", sort: 0 },
        ]).run();
      } else {
        const pos = ["POR", "DEF", "DEF", "DEF", "DEF", "MIG", "MIG", "MIG", "MIG", "DAV", "DAV", "POR", "DEF", "DEF", "MIG", "MIG", "DAV", "DAV", "POR", "DEF", "DEF", "MIG", "MIG", "DAV", "DEF", "MIG", "DAV", "DEF", "MIG", "DAV"];
        db.insert(schema.players).values(pos.map((p, i) => ({
          teamId: t.id, surname: `Jugador ${i + 1}`, name: "", position: p, dorsal: i + 1, registeredAt: "2026-09-01",
        }))).run();
        db.insert(schema.staff).values([{ teamId: t.id, name: "Delegat 1", role: "delegat", sort: 0 }, { teamId: t.id, name: "Delegat 2", role: "delegat", sort: 1 }]).run();
      }
    }
    for (const r of cal.rounds) {
      const [round] = db.insert(schema.rounds).values({ groupId: group.id, number: r.number, date: r.date, altDate: r.altDate ?? null }).returning().all();
      db.insert(schema.matches).values(r.matches.map((m: { home: string; away: string }) => ({
        roundId: round.id, homeId: teamId[m.home], awayId: teamId[m.away],
      }))).run();
    }
  }

  db.insert(schema.pages).values([
    { slug: "normativa", title: "Normativa veterans", body: "" },
    { slug: "reglament", title: "Reglament", body: "" },
    { slug: "arbitratges", title: "Arbitratges", body: "" },
    { slug: "contacte", title: "Contacte", body: "Comitè Organitzador · 972 204 640 · jaumemonegros@hotmail.com\nComitè de Competició · Pepe Muñoz · 696 675 831 · mu_sol@hotmail.com\nCol·legi d'Àrbitres · Miguel Ramírez Sanz · 600 671 913 · lilosuna68@hotmail.com" },
    { slug: "inici", title: "Amics del futbol amateur", body: "" },
  ]).run();

  const adminEmail = process.env.ADMIN_EMAIL || "admin@lliga.local";
  const adminPass = process.env.ADMIN_PASSWORD || "admin1234";
  db.insert(schema.users).values([
    { email: adminEmail, name: "Admin", passwordHash: bcrypt.hashSync(adminPass, 10), role: "admin", createdAt: now },
    { email: "president@lliga.local", name: "President de la lliga", passwordHash: bcrypt.hashSync("president1234", 10), role: "president_lliga", createdAt: now },
    { email: "arbitres@lliga.local", name: "President del comitè d'àrbitres", passwordHash: bcrypt.hashSync("arbitres1234", 10), role: "president_arbitres", createdAt: now },
  ]).run();
  await import("./import-arbitres");
  await import("./import-normativa");
  console.log(`Seeded. Admin: ${adminEmail} / ${adminPass} · president@lliga.local / president1234 · arbitres@lliga.local / arbitres1234`);
  void eq;
}
main();
