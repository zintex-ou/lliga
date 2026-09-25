/* Apply a league circular to the active season: results of a round, renames, kit notes, sanctions.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/jornada.ts
   Edit the DATA block per circular. Idempotent (results overwrite; sanctions keyed by player+round). */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

const ROUND = 3;
const RENAMES: Record<string, string> = { "Comacros C - La H": "UE Comacros Veterans B" };
const KITS: Record<string, string> = { "Athlètic Can Borell": "Primera equipació: samarreta vermella amb mànigues blanques i pantaló blanc amb línia vermella. Segona equipació: samarreta a ratlles horitzontals blanques i negres i pantaló blanc" };
// group, home, hg, ag, away
const RESULTS: [string, string, number, number, string][] = [
  ["A", "Real Guíxols FC", 2, 3, "Inter Lloret"],
  ["A", "Vet. Sporting Vidrerenca", 4, 5, "CE Sant Hilari-Font Vella"],
  ["A", "UE Comacros Veterans A", 5, 1, "FVB Vilobí"],
  ["A", "CE Anglès", 3, 3, "Veterans CF Sils"],
  ["A", "Anglès Huellas Colombia", 4, 1, "UE Comacros Veterans B"],
  ["A", "Atlético Empuriabrava", 1, 6, "Veteranos El Barrio"],
  ["A", "UCE Celrà", 1, 10, "Sàbat Veterans"],
  ["A", "Veterans d'Arbúcies", 5, 0, "Veterans La Batllòria"],
  ["A", "Majestic FC", 4, 5, "Veterans Pontenc"],
  ["B", "Restaurant Amura", 4, 0, "FC Palafrugell Veterans"],
  ["B", "Esportiu Bonmatí", 4, 0, "Athlètic Can Borell"],
  ["B", "Veterans Sant Antoni", 4, 4, "CE l'Aigüeta"],
  ["B", "Veterans Ath. Hostalric", 2, 1, "Veterans CE Farners"],
  ["B", "Veterans Sant Andreu", 3, 3, "CF Torderenc"],
  ["B", "EF Maçanet", 1, 2, "FC Honduras Figueres"],
  ["B", "Racing Blanenc B", 0, 4, "CF Fogars Veterans"],
  ["B", "Veterans CF Lloret", 4, 1, "Veterans Alt Empordà"],
  ["B", "Veterans Bordils-Flaçà", 4, 2, "CEF Veterans SFG"],
];
// team, full name as printed, matches (99 = fins a nou avís), note
const SANCTIONS: [string, string, number, string][] = [
  ["Veterans Pontenc", "Derek Jiménez Gallardo", 1, "Circular 19 setembre 2026"],
  ["Veterans d'Arbúcies", "Gerard Pascual Puig", 2, "Circular 19 setembre 2026"],
  ["Majestic FC", "John Carlos Siza Varón", 1, "Circular 19 setembre 2026"],
  ["EF Maçanet", "Spencer Lee Albert Croft", 1, "Circular 19 setembre 2026"],
  ["FC Honduras Figueres", "Kevin Joel Lanza Arriola", 1, "Circular 19 setembre 2026"],
  ["Racing Blanenc B", "Abdelmoutia Yahyaoui", 1, "Circular 19 setembre 2026"],
  ["CF Fogars Veterans", "Lyubomyr Stovban", 99, "Sancionat fins a nou avís (circular 19 setembre 2026)"],
];
// squad edits: team, surname of the player to replace (substring), new given name, new surname
const REPLACE: [string, string, string, string][] = [["CF Fogars Veterans", "Pastrana", "Lyubomyr", "Stovban"]];
// next round kick-off times/fields: group, home, away, time, field
const NEXT_ROUND = 4;
const NEXT_ROWS: [string, string, string, string, string][] = [
  ["A", "Inter Lloret", "Majestic FC", "19:00", "Municipal El Molí"],
  ["A", "CE Sant Hilari-Font Vella", "Real Guíxols FC", "18:00", "Municipal Sant Hilari Sacalm"],
  ["A", "FVB Vilobí", "Vet. Sporting Vidrerenca", "19:00", "Municipal Vilobí d'Onyar"],
  ["A", "Veterans CF Sils", "UE Comacros Veterans A", "18:00", "Municipal Sils"],
  ["A", "UE Comacros Veterans B", "CE Anglès", "16:00", "Municipal Comacros"],
  ["A", "Veteranos El Barrio", "Anglès Huellas Colombia", "17:00", "Municipal Vila-roja"],
  ["A", "Sàbat Veterans", "Atlético Empuriabrava", "17:30", "Municipal Germans Sàbat"],
  ["A", "Veterans La Batllòria", "UCE Celrà", "19:30", "Municipal La Batllòria"],
  ["A", "Veterans Pontenc", "Veterans d'Arbúcies", "17:00", "Municipal Pont Major"],
  ["B", "FC Palafrugell Veterans", "Veterans Bordils-Flaçà", "17:00", "Municipal El Gregal"],
  ["B", "Athlètic Can Borell", "Restaurant Amura", "17:00", "Municipal Can Borell"],
  ["B", "CE l'Aigüeta", "Esportiu Bonmatí", "17:00", "Municipal La Bisbal"],
  ["B", "Veterans CE Farners", "Veterans Sant Antoni", "19:30", "Municipal Santa Coloma"],
  ["B", "CF Torderenc", "Veterans Ath. Hostalric", "18:00", "Municipal Tordera"],
  ["B", "FC Honduras Figueres", "Veterans Sant Andreu", "17:00", "Municipal La Salle Figueres"],
  ["B", "CF Fogars Veterans", "EF Maçanet", "15:30", "Municipal Fogars"],
  ["B", "Veterans Alt Empordà", "Racing Blanenc B", "18:00", "Municipal Bàscara"],
  ["B", "CEF Veterans SFG", "Veterans CF Lloret", "16:00", "Municipal Mascanada"],
];

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
  for (const [g, home, hg, ag, away] of RESULTS) {
    const group = groups.find((x) => x.name === g)!;
    const h = find(home), a = find(away);
    if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); continue; }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, group.id), eq(schema.rounds.number, ROUND))).get()!;
    const m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, h.id), eq(schema.matches.awayId, a.id))).get();
    if (!m) { console.log(`✗ match not in J${ROUND}: ${home} – ${away}`); continue; }
    db.update(schema.matches).set({ status: "played", homeGoals: hg, awayGoals: ag, published: true, updatedAt: now }).where(eq(schema.matches.id, m.id)).run();
    console.log(`✓ J${ROUND} ${h.name} ${hg}-${ag} ${a.name}`);
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
    const parts = full.trim().split(/\s+/);
    const given = parts.length >= 4 ? parts.slice(0, 2).join(" ") : parts[0];
    const surname = parts.length >= 4 ? parts.slice(2).join(" ") : parts.slice(1).join(" ");
    let p = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all().find((x) => norm(`${x.name} ${x.surname}`) === norm(full) || norm(`${x.surname} ${x.name}`) === norm(full) || norm(x.surname) === norm(surname));
    if (!p) {
      // reuse the last placeholder slot if the squad is still a placeholder one
      const ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, t.id), like(schema.players.surname, "Jugador %"))).orderBy(desc(schema.players.id)).get();
      if (ph) { db.update(schema.players).set({ surname, name: given, dorsal: null }).where(eq(schema.players.id, ph.id)).run(); p = { ...ph, surname, name: given }; }
      else { const [np] = db.insert(schema.players).values({ teamId: t.id, surname, name: given, position: "MIG", registeredAt: "2026-09-19" }).returning().all(); p = np; }
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
