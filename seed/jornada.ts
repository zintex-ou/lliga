/* Apply a league circular to the active season: results of a round, renames, kit notes, sanctions.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/jornada.ts
   Edit the DATA block per circular. Idempotent (results overwrite; sanctions keyed by player+round). */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

const ROUND = 5;
const RENAMES: Record<string, string> = {};
const KITS: Record<string, string> = {};
// group, home, hg, ag, away, note
const RESULTS: [string, string, number, number, string, string?][] = [
  ["A", "Inter Lloret", 6, 2, "CE Sant Hilari-Font Vella"],
  ["A", "Real Guíxols FC", 3, 3, "FVB Vilobí"],
  ["A", "Vet. Sporting Vidrerenca", 2, 2, "Veterans CF Sils"],
  ["A", "UE Comacros Veterans A", 4, 3, "UE Comacros Veterans B"],
  ["A", "CE Anglès", 3, 5, "Veteranos El Barrio"],
  ["A", "Anglès Huellas Colombia", 3, 2, "Sàbat Veterans"],
  ["A", "Atlético Empuriabrava", 3, 0, "Veterans La Batllòria"],
  ["A", "UCE Celrà", 0, 11, "Veterans Pontenc"],
  ["B", "FC Palafrugell Veterans", 3, 2, "Athlètic Can Borell"],
  ["B", "Restaurant Amura", 5, 0, "CE l'Aigüeta"],
  ["B", "Esportiu Bonmatí", 1, 1, "Veterans CE Farners"],
  ["B", "Veterans Sant Antoni", 4, 1, "CF Torderenc"],
  ["B", "Veterans Ath. Hostalric", 2, 2, "FC Honduras Figueres"],
  ["B", "Veterans Sant Andreu", 1, 6, "CF Fogars Veterans"],
  ["B", "EF Maçanet", 9, 1, "Veterans Alt Empordà"],
  ["B", "Veterans Bordils-Flaçà", 2, 3, "Veterans CF Lloret"],
];
// postponed matches: group, home, away, note
const POSTPONED_NOTE = "Ajornat per força major (protocol de seguretat per fortes tempestes). Els delegats han de pactar la data de recuperació.";
const POSTPONED: [string, string, string, string][] = [
  ["A", "Majestic FC", "Veterans d'Arbúcies", POSTPONED_NOTE],
  ["B", "Racing Blanenc B", "CEF Veterans SFG", POSTPONED_NOTE],
];
// team, "Given|Surnames" (or full name as printed), matches (99 = fins a nou avís), note
const SANCTIONS: [string, string, number, string][] = [
  ["Anglès Huellas Colombia", "Daniel|Aplicano A. Rodríguez", 3, "Circular 3 octubre 2026"],
  ["Anglès Huellas Colombia", "Daniel A.|Aplicano Figueroa", 3, "Circular 3 octubre 2026"],
  ["Anglès Huellas Colombia", "Diego H.|Rojas Zambrano", 2, "Circular 3 octubre 2026"],
  ["FC Honduras Figueres", "Mouslih|Kilou", 1, "Circular 3 octubre 2026"],
];
// squad edits: team, surname of the player to replace (substring), new given name, new surname
const REPLACE: [string, string, string, string][] = [];
// next round kick-off times/fields: group, home, away, time, field
const NEXT_ROUND = 6;
const NEXT_ROWS: [string, string, string, string, string][] = [];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const teamKey = (name: string) => name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

function main() {
  const season = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get()!;
  const groups = db.select().from(schema.groups).where(eq(schema.groups.seasonId, season.id)).all();
  const gids = groups.map((g) => g.id);
  const allTeams = () => db.select().from(schema.teams).all().filter((t) => gids.includes(t.groupId));
  for (const [from, to] of Object.entries(RENAMES)) {
    const t = allTeams().find((x) => x.name === from);
    if (!t) continue;
    db.update(schema.teams).set({ name: to, slug: slugify(to), short: null }).where(eq(schema.teams.id, t.id)).run();
    db.update(schema.teamPhotos).set({ teamKey: teamKey(to) }).where(eq(schema.teamPhotos.teamKey, teamKey(from))).run();
    console.log(`✓ rename ${from} → ${to}`);
  }
  const find = (name: string) => { const n = norm(name); return allTeams().find((t) => norm(t.name) === n) ?? allTeams().find((t) => norm(t.name).includes(n) || n.includes(norm(t.name))); };
  for (const [team, kit] of Object.entries(KITS)) { const t = find(team); if (t) { db.update(schema.teams).set({ colors: kit }).where(eq(schema.teams.id, t.id)).run(); console.log(`✓ indumentària ${t.name}`); } }
  const now = new Date().toISOString();
  for (const [g, home, hg, ag, away, note] of RESULTS) {
    const group = groups.find((x) => x.name === g)!;
    const h = find(home), a = find(away);
    if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); continue; }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, group.id), eq(schema.rounds.number, ROUND))).get()!;
    const m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, h.id), eq(schema.matches.awayId, a.id))).get();
    if (!m) { console.log(`✗ match not in J${ROUND}: ${home} – ${away}`); continue; }
    db.update(schema.matches).set({ status: "played", homeGoals: hg, awayGoals: ag, published: true, updatedAt: now, ...(note ? { notes: note } : {}) }).where(eq(schema.matches.id, m.id)).run();
    console.log(`✓ J${ROUND} ${h.name} ${hg}-${ag} ${a.name}`);
  }
  for (const [g, home, away, note] of POSTPONED) {
    const group = groups.find((x) => x.name === g)!;
    const h = find(home), a = find(away);
    if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); continue; }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, group.id), eq(schema.rounds.number, ROUND))).get()!;
    const m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, h.id), eq(schema.matches.awayId, a.id))).get();
    if (!m) { console.log(`✗ match not in J${ROUND}: ${home} – ${away}`); continue; }
    db.update(schema.matches).set({ status: "postponed", homeGoals: null, awayGoals: null, published: true, notes: note, updatedAt: now }).where(eq(schema.matches.id, m.id)).run();
    console.log(`✓ J${ROUND} ajornat ${h.name} – ${a.name}`);
  }
  for (const [team, old, given, surname] of REPLACE) {
    const t = find(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const p = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all().find((x) => norm(x.surname).includes(norm(old)));
    if (!p) { console.log(`✗ jugador ${old} no trobat a ${t.name}`); continue; }
    db.update(schema.players).set({ name: given, surname }).where(eq(schema.players.id, p.id)).run();
    console.log(`✓ ${t.name}: ${p.surname}, ${p.name} → ${surname}, ${given}`);
  }
  for (const [team, full, matches, note] of SANCTIONS) {
    const t = find(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const parts = full.replace("|", " ").trim().split(/\s+/);
    const given = full.includes("|") ? full.split("|")[0].trim() : parts.length >= 4 ? parts.slice(0, 2).join(" ") : parts[0];
    const surname = full.includes("|") ? full.split("|")[1].trim() : parts.length >= 4 ? parts.slice(2).join(" ") : parts.slice(1).join(" ");
    let p = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all().find((x) => norm(`${x.name} ${x.surname}`) === norm(full.replace("|", " ")) || norm(`${x.surname} ${x.name}`) === norm(full.replace("|", " ")) || norm(x.surname) === norm(surname));
    if (!p) {
      // reuse the last placeholder slot if the squad is still a placeholder one
      const ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, t.id), like(schema.players.surname, "Jugador %"))).orderBy(desc(schema.players.id)).get();
      if (ph) { db.update(schema.players).set({ surname, name: given, dorsal: null }).where(eq(schema.players.id, ph.id)).run(); p = { ...ph, surname, name: given }; }
      else { const [np] = db.insert(schema.players).values({ teamId: t.id, surname, name: given, position: "MIG", registeredAt: "2026-10-03" }).returning().all(); p = np; }
      console.log(`  + jugador ${surname}, ${given} (${t.name})`);
    }
    const exists = db.select().from(schema.sanctions).where(and(eq(schema.sanctions.playerId, p.id), eq(schema.sanctions.roundNumber, ROUND + 1))).get();
    if (exists) { db.update(schema.sanctions).set({ matches, notes: note }).where(eq(schema.sanctions.id, exists.id)).run(); }
    else db.insert(schema.sanctions).values({ playerId: p.id, roundNumber: ROUND + 1, matches, reason: "comite", notes: note, createdAt: now }).run();
    console.log(`✓ sanció ${surname}, ${given} (${t.name}): ${matches === 99 ? "fins a nou avís" : matches + " partit(s)"}`);
  }
  for (const [g, home, away, time, field] of NEXT_ROWS) {
    const group = groups.find((x) => x.name === g)!;
    const h = find(home), a = find(away);
    if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); continue; }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, group.id), eq(schema.rounds.number, NEXT_ROUND))).get()!;
    let m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, h.id), eq(schema.matches.awayId, a.id))).get();
    if (!m) {
      m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, a.id), eq(schema.matches.awayId, h.id))).get();
      if (!m) { console.log(`✗ match not in J${NEXT_ROUND}: ${home} – ${away}`); continue; }
      db.update(schema.matches).set({ homeId: h.id, awayId: a.id }).where(eq(schema.matches.id, m.id)).run();
      console.log(`  (home/away swapped) ${home} – ${away}`);
    }
    db.update(schema.matches).set({ time, field, updatedAt: now }).where(eq(schema.matches.id, m.id)).run();
    console.log(`✓ J${NEXT_ROUND} ${h.name} – ${a.name} · ${time} ${field}`);
  }
}
main();
