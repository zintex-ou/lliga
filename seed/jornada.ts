/* Apply a league circular to the active season: results of a round, renames, kit notes, sanctions.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/jornada.ts
   Edit the DATA block per circular. Idempotent (results overwrite; sanctions keyed by player+round). */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

const ROUND = 8; // last round in this circular batch (used for defaults only)
const RENAMES: Record<string, string> = {};
const KITS: Record<string, string> = {};
// round, group, home, hg, ag, away, note
const RESULTS: [number, string, string, number, number, string, string?][] = [
  [7, "A", "CE Sant Hilari-Font Vella", 1, 2, "FVB Vilobí"],
  [7, "A", "Inter Lloret", 4, 1, "Veterans CF Sils"],
  [7, "A", "Real Guíxols FC", 1, 2, "UE Comacros Veterans B"],
  [7, "A", "Vet. Sporting Vidrerenca", 1, 6, "Veteranos El Barrio"],
  [7, "A", "UE Comacros Veterans A", 2, 2, "Sàbat Veterans"],
  [7, "A", "CE Anglès", 4, 2, "Veterans La Batllòria"],
  [7, "A", "Anglès Huellas Colombia", 4, 2, "Veterans Pontenc"],
  [7, "A", "Atlético Empuriabrava", 7, 1, "Veterans d'Arbúcies"],
  [7, "B", "Athlètic Can Borell", 3, 0, "CE l'Aigüeta"],
  [7, "B", "FC Palafrugell Veterans", 6, 3, "Veterans CE Farners"],
  [7, "B", "Restaurant Amura", 0, 3, "CF Torderenc", "Pendent de resolució de l'acta (possible recurs)"],
  [7, "B", "Esportiu Bonmatí", 2, 1, "FC Honduras Figueres"],
  [7, "B", "Veterans Sant Antoni", 2, 2, "CF Fogars Veterans"],
  [7, "B", "Veterans Sant Andreu", 7, 3, "CEF Veterans SFG"],
  [7, "B", "EF Maçanet", 3, 2, "Veterans CF Lloret"],
  [7, "B", "Veterans Bordils-Flaçà", 6, 2, "Racing Blanenc B"],
  [8, "A", "FVB Vilobí", 4, 1, "Majestic FC"],
  [8, "A", "Veterans CF Sils", 6, 2, "CE Sant Hilari-Font Vella"],
  [8, "A", "UE Comacros Veterans B", 1, 2, "Inter Lloret"],
  [8, "A", "Veteranos El Barrio", 3, 2, "Real Guíxols FC"],
  [8, "A", "Sàbat Veterans", 4, 2, "Vet. Sporting Vidrerenca"],
  [8, "A", "Veterans La Batllòria", 1, 6, "UE Comacros Veterans A"],
  [8, "A", "Veterans Pontenc", 2, 1, "CE Anglès"],
  [8, "B", "CE l'Aigüeta", 1, 3, "Veterans Bordils-Flaçà"],
  [8, "B", "Veterans CE Farners", 2, 1, "Athlètic Can Borell"],
  [8, "B", "CF Torderenc", 3, 0, "FC Palafrugell Veterans"],
  [8, "B", "FC Honduras Figueres", 6, 4, "Restaurant Amura"],
  [8, "B", "CF Fogars Veterans", 5, 2, "Esportiu Bonmatí"],
  [8, "B", "Veterans Alt Empordà", 2, 4, "Veterans Sant Antoni"],
  [8, "B", "CEF Veterans SFG", 2, 0, "Veterans Ath. Hostalric"],
  [8, "B", "Veterans CF Lloret", 4, 0, "Veterans Sant Andreu"],
  [8, "B", "Racing Blanenc B", 1, 1, "EF Maçanet"],
];
// postponed / pending matches: round, group, home, away, note
const POSTPONED: [number, string, string, string, string][] = [
  [7, "A", "Majestic FC", "UCE Celrà", "Ajornat per alerta de fortes pluges (17/10/26). Els delegats han de pactar la data de recuperació."],
  [7, "B", "Veterans Ath. Hostalric", "Veterans Alt Empordà", "Suspès al minut 6 per fortes pluges (17/10/26). Els delegats han de pactar la data de recuperació."],
  [8, "A", "Veterans d'Arbúcies", "Anglès Huellas Colombia", "Ajornat per manca de jugadors d'Anglès Huellas Colombia (únic ajornament permès pel Reglament)."],
  [8, "A", "UCE Celrà", "Atlético Empuriabrava", "Resultat pendent a l'espera de possible presentació de recurs."],
  [5, "A", "Majestic FC", "Veterans d'Arbúcies", "Ajornat per força major (03/10/26). Es jugarà el 03/11/26."],
];
// round (sanction counts from round+1), team, "Given|Surnames", matches (99 = fins a nou avís), note
const SANCTIONS: [number, string, string, number, string][] = [
  [7, "Inter Lloret", "Eric|Meyer Abeldaño", 2, "Circular 17 octubre 2026"],
  [7, "Restaurant Amura", "Noureddine|Gairane", 6, "Circular 24 octubre 2026 (partit del 17/10/26)"],
];
// new squad members: team, given, surname, dob (ISO)
const ADD: [string, string, string, string | null][] = [];
// squad edits: team, surname of the player to replace (substring), new given name, new surname
const REPLACE: [string, string, string, string][] = [];
// next round kick-off times/fields: group, home, away, time, field
const NEXT_ROUND = 9;
const NEXT_ROWS: [string, string, string, string, string][] = [
  ["A", "CE Sant Hilari-Font Vella", "UE Comacros Veterans B", "17:30", "Municipal Sant Hilari Sacalm"],
  ["A", "Inter Lloret", "Veteranos El Barrio", "20:00", "Municipal Lloret"],
  ["A", "Real Guíxols FC", "Sàbat Veterans", "18:00", "Municipal Mascanada"],
  ["A", "Vet. Sporting Vidrerenca", "Veterans La Batllòria", "16:00", "Municipal Vidreres"],
  ["A", "UE Comacros Veterans A", "Veterans Pontenc", "18:00", "Municipal Comacros"],
  ["A", "CE Anglès", "Veterans d'Arbúcies", "18:00", "Municipal Anglès"],
  ["A", "Anglès Huellas Colombia", "UCE Celrà", "16:00", "Municipal Anglès"],
  ["A", "Majestic FC", "Atlético Empuriabrava", "19:00", "Ciutat Esportiva Blanes"],
  ["B", "CE l'Aigüeta", "Veterans CE Farners", "17:00", "Municipal La Bisbal"],
  ["B", "Athlètic Can Borell", "CF Torderenc", "17:00", "Municipal Can Borell"],
  ["B", "FC Palafrugell Veterans", "FC Honduras Figueres", "18:15", "Municipal El Gregal"],
  ["B", "Restaurant Amura", "CF Fogars Veterans", "20:00", "Municipal Mascanada"],
  ["B", "Esportiu Bonmatí", "Veterans Alt Empordà", "16:00", "Municipal Bonmatí"],
  ["B", "Veterans Sant Antoni", "CEF Veterans SFG", "15:15", "Municipal Sant Antoni"],
  ["B", "Veterans Ath. Hostalric", "Veterans CF Lloret", "17:00", "Municipal Hostalric"],
  ["B", "Veterans Sant Andreu", "Racing Blanenc B", "16:00", "Municipal Tordera"],
  ["B", "Veterans Bordils-Flaçà", "EF Maçanet", "16:00", "Municipal Flaçà"],
];
// next-round matches postponed before kick-off: group, home, away, note
const NEXT_POSTPONED: [string, string, string, string][] = [["A", "FVB Vilobí", "Veterans CF Sils", "Ajornat. Els delegats han de pactar la data de recuperació."]];

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
  const matchOf = (rn: number, g: string, home: string, away: string) => {
    const group = groups.find((x) => x.name === g)!;
    const h = find(home), a = find(away);
    if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); return null; }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, group.id), eq(schema.rounds.number, rn))).get()!;
    const m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, h.id), eq(schema.matches.awayId, a.id))).get();
    if (!m) { console.log(`✗ match not in J${rn}: ${home} – ${away}`); return null; }
    return { m, h, a };
  };
  for (const [rn, g, home, hg, ag, away, note] of RESULTS) {
    const x = matchOf(rn, g, home, away); if (!x) continue;
    db.update(schema.matches).set({ status: "played", homeGoals: hg, awayGoals: ag, published: true, updatedAt: now, ...(note ? { notes: note } : {}) }).where(eq(schema.matches.id, x.m.id)).run();
    console.log(`✓ J${rn} ${x.h.name} ${hg}-${ag} ${x.a.name}`);
  }
  for (const [rn, g, home, away, note] of POSTPONED) {
    const x = matchOf(rn, g, home, away); if (!x) continue;
    db.update(schema.matches).set({ status: "postponed", homeGoals: null, awayGoals: null, published: true, notes: note, updatedAt: now }).where(eq(schema.matches.id, x.m.id)).run();
    console.log(`✓ J${rn} ajornat ${x.h.name} – ${x.a.name}`);
  }
  for (const [g, home, away, note] of NEXT_POSTPONED) {
    const x = matchOf(NEXT_ROUND, g, home, away); if (!x) continue;
    db.update(schema.matches).set({ status: "postponed", time: null, published: true, notes: note, updatedAt: now }).where(eq(schema.matches.id, x.m.id)).run();
    console.log(`✓ J${NEXT_ROUND} ajornat ${x.h.name} – ${x.a.name}`);
  }
  for (const [team, given, surname, dob] of ADD) {
    const t = find(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const squad = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all();
    const ex = squad.find((x) => norm(x.surname) === norm(surname) && norm(x.name) === norm(given));
    if (ex) { if (dob && !ex.dob) db.update(schema.players).set({ dob }).where(eq(schema.players.id, ex.id)).run(); console.log(`= ${surname}, ${given} ja és a ${t.name}`); continue; }
    const ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, t.id), like(schema.players.surname, "Jugador %"))).orderBy(desc(schema.players.id)).get();
    if (ph) db.update(schema.players).set({ surname, name: given, dob, dorsal: null }).where(eq(schema.players.id, ph.id)).run();
    else db.insert(schema.players).values({ teamId: t.id, surname, name: given, dob, position: "MIG", registeredAt: "2026-10-24" }).run();
    console.log(`✓ + ${surname}, ${given} (${t.name})`);
  }
  for (const [team, old, given, surname] of REPLACE) {
    const t = find(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const p = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all().find((x) => norm(x.surname).includes(norm(old)));
    if (!p) { console.log(`✗ jugador ${old} no trobat a ${t.name}`); continue; }
    db.update(schema.players).set({ name: given, surname }).where(eq(schema.players.id, p.id)).run();
    console.log(`✓ ${t.name}: ${p.surname}, ${p.name} → ${surname}, ${given}`);
  }
  for (const [rn, team, full, matches, note] of SANCTIONS) {
    const t = find(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const parts = full.replace("|", " ").trim().split(/\s+/);
    const given = full.includes("|") ? full.split("|")[0].trim() : parts.length >= 4 ? parts.slice(0, 2).join(" ") : parts[0];
    const surname = full.includes("|") ? full.split("|")[1].trim() : parts.length >= 4 ? parts.slice(2).join(" ") : parts.slice(1).join(" ");
    let p = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all().find((x) => norm(`${x.name} ${x.surname}`) === norm(full.replace("|", " ")) || norm(`${x.surname} ${x.name}`) === norm(full.replace("|", " ")) || norm(x.surname) === norm(surname));
    if (!p) {
      // reuse the last placeholder slot if the squad is still a placeholder one
      const ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, t.id), like(schema.players.surname, "Jugador %"))).orderBy(desc(schema.players.id)).get();
      if (ph) { db.update(schema.players).set({ surname, name: given, dorsal: null }).where(eq(schema.players.id, ph.id)).run(); p = { ...ph, surname, name: given }; }
      else { const [np] = db.insert(schema.players).values({ teamId: t.id, surname, name: given, position: "MIG", registeredAt: "2026-10-24" }).returning().all(); p = np; }
      console.log(`  + jugador ${surname}, ${given} (${t.name})`);
    }
    const exists = db.select().from(schema.sanctions).where(and(eq(schema.sanctions.playerId, p.id), eq(schema.sanctions.roundNumber, rn + 1))).get();
    if (exists) { db.update(schema.sanctions).set({ matches, notes: note }).where(eq(schema.sanctions.id, exists.id)).run(); }
    else db.insert(schema.sanctions).values({ playerId: p.id, roundNumber: rn + 1, matches, reason: "comite", notes: note, createdAt: now }).run();
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
