/* Apply published kick-off times/fields for a round and team renames.
   Run inside the app container:  node node_modules/tsx/dist/cli.mjs seed/horaris.ts
   Idempotent. Edit ROUND / ROWS / RENAMES for each new round. */
import { db, schema } from "../src/db";
import { eq, and } from "drizzle-orm";

const RENAMES: Record<string, string> = { "Bar Moreda": "Restaurant Amura", "Veterans San Andrés": "Veterans Sant Andreu" };
const ALIASES: Record<string, string> = { "fb vilobi": "fvb vilobi", "ce sant hilari font vella": "ce sant hilari font vella" };
const ROUND = 3;
// group, home, away, time, field, note
const ROWS: [string, string, string, string, string, string?][] = [
  ["A", "Real Guíxols FC", "Inter Lloret", "18:00", "Municipal Vilartagues"],
  ["A", "Vet. Sporting Vidrerenca", "CE Sant Hilari-Font Vella", "19:00", "Municipal Sant Hilari", "Permuta de camp"],
  ["A", "UE Comacros Veterans A", "FVB Vilobí", "18:00", "Municipal Comacros"],
  ["A", "CE Anglès", "Veterans CF Sils", "18:00", "Municipal Anglès"],
  ["A", "Anglès Huellas Colombia", "Comacros C - La H", "16:00", "Municipal Anglès"],
  ["A", "Atlético Empuriabrava", "Veteranos El Barrio", "17:00", "Municipal Aeroclub"],
  ["A", "UCE Celrà", "Sàbat Veterans", "16:45", "Municipal Celrà"],
  ["A", "Veterans d'Arbúcies", "Veterans La Batllòria", "18:30", "Municipal Arbúcies"],
  ["A", "Majestic FC", "Veterans Pontenc", "19:15", "Ciutat Esportiva Blanes"],
  ["B", "Restaurant Amura", "FC Palafrugell Veterans", "16:00", "Municipal Vilartagues"],
  ["B", "Esportiu Bonmatí", "Athlètic Can Borell", "17:00", "Municipal Bonmatí"],
  ["B", "Veterans Sant Antoni", "CE l'Aigüeta", "15:15", "Municipal Sant Antoni"],
  ["B", "Veterans Ath. Hostalric", "Veterans CE Farners", "17:00", "Municipal Hostalric"],
  ["B", "Veterans Sant Andreu", "CF Torderenc", "18:00", "Municipal Tordera"],
  ["B", "EF Maçanet", "FC Honduras Figueres", "18:00", "Municipal Maçanet"],
  ["B", "Racing Blanenc B", "CF Fogars Veterans", "17:00", "Municipal Can Borell"],
  ["B", "Veterans CF Lloret", "Veterans Alt Empordà", "15:00", "Municipal Lloret"],
  ["B", "Veterans Bordils-Flaçà", "CEF Veterans SFG", "17:30", "Municipal Flaçà"],
];
// the return leg of a "permuta" is played at the other team's ground
const RETURN_FIELDS: [string, string, string, string][] = [["A", "CE Sant Hilari-Font Vella", "Vet. Sporting Vidrerenca", "Municipal de Vidreres"]];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const teamKey = (name: string) => name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function main() {
  const season = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get()!;
  const groups = db.select().from(schema.groups).where(eq(schema.groups.seasonId, season.id)).all();
  // renames
  for (const [from, to] of Object.entries(RENAMES)) {
    for (const g of groups) {
      const t = db.select().from(schema.teams).where(and(eq(schema.teams.groupId, g.id), eq(schema.teams.name, from))).get();
      if (!t) continue;
      db.update(schema.teams).set({ name: to, slug: slugify(to), short: null }).where(eq(schema.teams.id, t.id)).run();
      db.update(schema.teamPhotos).set({ teamKey: teamKey(to) }).where(eq(schema.teamPhotos.teamKey, teamKey(from))).run();
      console.log(`✓ rename ${from} → ${to}`);
    }
  }
  const find = (gId: number, name: string) => {
    const teams = db.select().from(schema.teams).where(eq(schema.teams.groupId, gId)).all();
    const n = ALIASES[norm(name)] ?? norm(name);
    return teams.find((t) => norm(t.name) === n) ?? teams.find((t) => norm(t.name).includes(n) || n.includes(norm(t.name)));
  };
  const apply = (gName: string, home: string, away: string, round: number, patch: Partial<typeof schema.matches.$inferInsert>) => {
    const g = groups.find((x) => x.name === gName)!;
    const h = find(g.id, home), a = find(g.id, away);
    if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); return; }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, g.id), eq(schema.rounds.number, round))).get()!;
    let m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, h.id), eq(schema.matches.awayId, a.id))).get();
    if (!m) {
      m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, a.id), eq(schema.matches.awayId, h.id))).get();
      if (!m) { console.log(`✗ match not in J${round}: ${home} – ${away}`); return; }
      db.update(schema.matches).set({ homeId: h.id, awayId: a.id }).where(eq(schema.matches.id, m.id)).run();
      console.log(`  (home/away swapped) ${home} – ${away}`);
    }
    db.update(schema.matches).set(patch).where(eq(schema.matches.id, m.id)).run();
    console.log(`✓ J${round} ${h.name} – ${a.name} · ${patch.time ?? ""} ${patch.field ?? ""}`);
  };
  for (const [g, home, away, time, field, note] of ROWS) apply(g, home, away, ROUND, { time, field, ...(note ? { notes: note } : {}) });
  for (const [g, home, away, field] of RETURN_FIELDS) apply(g, home, away, ROUND + 17, { field, notes: "Permuta de camp" });
}
main();
