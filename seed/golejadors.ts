/* Top-scorers table update (after J5): add new players, fix names, and record J5 goals as match events.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/golejadors.ts
   Idempotent: players matched by surname; goal events only topped up to the expected count. */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

const ROUND = 5;
const REGISTERED = "2026-10-03";
// team → [surname-substring to find, new given, new surname]
const FIX: [string, string, string, string][] = [
  ["CF Fogars Veterans", "Dacjhonny", "Franco", "Rodríguez Delyhonny"],
];
// team → "Given|Surnames" (new players)
const NEW: Record<string, string[]> = {
  "Veterans Alt Empordà": ["Adrià|Fernández Cantarero"],
  "Athlètic Can Borell": ["Mariano N.|Bugna Alonso", "Miguel|Carmona Arjona"],
  "Restaurant Amura": ["Alex|Malca Caballero", "Hassane|Chitta Bouskour", "Abdellah|Boussif Bilal"],
  "Veterans Bordils-Flaçà": ["Jorge|Marques Rebelo"],
  "Veterans CE Farners": ["Emanuel|Amherdt"],
  "CF Fogars Veterans": ["Carlos|Ortiz Ortiz", "Ievgen|Zinchenko", "Jake|Clarke Pulido", "Francisco|Seguí Martín"],
  "Veterans Ath. Hostalric": ["Denys|Oliinyk", "Lainez|Murillo"],
  "Veterans CF Lloret": ["Andrés|Serna Botella"],
  "EF Maçanet": ["Sergio|Bravo Suárez", "Víctor|Camacho Coll", "Cristian|Llanos Cabezas", "Carlos J.|Núñez Acaso", "Cristian|Blanco Escobar", "Pablo|Díaz Cherrato"],
  "FC Palafrugell Veterans": ["Diego S.|Pérez Roldán", "Khalil|Daia Laasal"],
  "Veterans Sant Antoni": ["Michael|Beaussant", "Ismael|Jiménez Vega", "Pablo|Subirana Ysita"],
  "Veterans Sant Andreu": ["Miguel|Cabello Melero"],
  "Atlético Empuriabrava": ["Etin|Catovic Avdic"],
  "UE Comacros Veterans B": ["Álvaro|Rodríguez Soto"],
  "Inter Lloret": ["Darwin Dante|Triana"],
  "Veterans Pontenc": ["Pau|Vargas Alcalde"],
  "Real Guíxols FC": ["Ismail|Chagrani Lemallen", "Ilyas|Laatiaoui"],
  "Sàbat Veterans": ["Aitor|Arana Araque", "Enrique|Pérez Pinto"],
  "CE Sant Hilari-Font Vella": ["Daniel|Nica Ștefan"],
  "FVB Vilobí": ["Edgar|López Machuca"],
  "Vet. Sporting Vidrerenca": ["Alejandro|Villaverde Pérez"],
};
// J5 goals: team, "Given|Surnames", goals in that match
const GOALS: [string, string, number][] = [
  ["Restaurant Amura", "Mohamed|Boussif Bilal", 1], ["Restaurant Amura", "Àlex|Carrasquilla Rico", 1], ["Restaurant Amura", "Alex|Malca Caballero", 1], ["Restaurant Amura", "Hassane|Chitta Bouskour", 1], ["Restaurant Amura", "Abdellah|Boussif Bilal", 1],
  ["Veterans Alt Empordà", "Adrià|Fernández Cantarero", 1],
  ["EF Maçanet", "Sergio|Bravo Suárez", 2], ["EF Maçanet", "Víctor|Camacho Coll", 2], ["EF Maçanet", "Cristian|Llanos Cabezas", 2], ["EF Maçanet", "Carlos J.|Núñez Acaso", 1], ["EF Maçanet", "Cristian|Blanco Escobar", 1], ["EF Maçanet", "Pablo|Díaz Cherrato", 1],
  ["Athlètic Can Borell", "Mariano N.|Bugna Alonso", 1], ["Athlètic Can Borell", "Miguel|Carmona Arjona", 1],
  ["FC Palafrugell Veterans", "Adrià|Ortega Cabaño", 1], ["FC Palafrugell Veterans", "Diego S.|Pérez Roldán", 1], ["FC Palafrugell Veterans", "Khalil|Daia Laasal", 1],
  ["Esportiu Bonmatí", "Robert|Carbó Lloveras", 1],
  ["Veterans CE Farners", "Emanuel|Amherdt", 1],
  ["Veterans Bordils-Flaçà", "Jaume|Furriols Franco", 1], ["Veterans Bordils-Flaçà", "Jorge|Marques Rebelo", 1],
  ["Veterans CF Lloret", "Andrés|Serna Botella", 2], ["Veterans CF Lloret", "Rubén|Durán Ayala", 1],
  ["CF Fogars Veterans", "Alexander|Andreev", 1], ["CF Fogars Veterans", "Franco|Rodríguez Delyhonny", 1], ["CF Fogars Veterans", "Carlos|Ortiz Ortiz", 1], ["CF Fogars Veterans", "Ievgen|Zinchenko", 1], ["CF Fogars Veterans", "Jake|Clarke Pulido", 1], ["CF Fogars Veterans", "Francisco|Seguí Martín", 1],
  ["Veterans Sant Andreu", "Miguel|Cabello Melero", 1],
  ["FC Honduras Figueres", "Fabricio|Escoto Olivera", 1], ["FC Honduras Figueres", "Mouslih|Kilou", 1],
  ["Veterans Ath. Hostalric", "Denys|Oliinyk", 1], ["Veterans Ath. Hostalric", "Lainez|Murillo", 1],
  ["Veterans Sant Antoni", "Michael|Beaussant", 2], ["Veterans Sant Antoni", "Ismael|Jiménez Vega", 1], ["Veterans Sant Antoni", "Pablo|Subirana Ysita", 1],
  ["CF Torderenc", "Ismael|Cabrera Gómez", 1],
  ["Inter Lloret", "Dany|Almendares Ramos", 4], ["Inter Lloret", "Darwin Dante|Triana", 1], ["Inter Lloret", "Joubair|Makfaoui", 1],
  ["CE Sant Hilari-Font Vella", "Leandro|Lisboa dos Santos", 1], ["CE Sant Hilari-Font Vella", "Daniel|Nica Ștefan", 1],
  ["Real Guíxols FC", "Ismail|Chagrani Lemallen", 2], ["Real Guíxols FC", "Ilyas|Laatiaoui", 1],
  ["FVB Vilobí", "Àlex|Zamora Lazo", 2], ["FVB Vilobí", "Edgar|López Machuca", 1],
  ["Vet. Sporting Vidrerenca", "Alejandro|Villaverde Pérez", 2],
  ["Veterans CF Sils", "Gerard|González Martínez", 2],
  ["UE Comacros Veterans A", "Jonhy M.|Galeano Cruz", 2], ["UE Comacros Veterans A", "Henri L.|Durón García", 2],
  ["UE Comacros Veterans B", "Álvaro|Rodríguez Soto", 3],
  ["CE Anglès", "Raúl|Morazan Matute", 2], ["CE Anglès", "Nahum|Molina Acosta", 1],
  ["Veteranos El Barrio", "Cristian|Rodríguez Jiménez", 3], ["Veteranos El Barrio", "Daniel|Albalá Angulo", 1], ["Veteranos El Barrio", "José|Marín Ferrer", 1],
  ["Anglès Huellas Colombia", "Juan|González Vélez", 1], ["Anglès Huellas Colombia", "Jampier|Riascos Mosquera", 1], ["Anglès Huellas Colombia", "Golbery|Sinisterra Moreno", 1],
  ["Sàbat Veterans", "Aitor|Arana Araque", 1], ["Sàbat Veterans", "Enrique|Pérez Pinto", 1],
  ["Atlético Empuriabrava", "Etin|Catovic Avdic", 2], ["Atlético Empuriabrava", "Aitor|Reyes Sánchez", 1],
  ["Veterans Pontenc", "Daniel|Pedraza Tejada", 3], ["Veterans Pontenc", "Rubén|Jiménez González", 2], ["Veterans Pontenc", "Brian J.|Elvir Hernández", 1], ["Veterans Pontenc", "Derek|Jiménez Gallardo", 3], ["Veterans Pontenc", "Pau|Vargas Alcalde", 2],
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function main() {
  const season = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get()!;
  const groups = db.select().from(schema.groups).where(eq(schema.groups.seasonId, season.id)).all();
  const gids = groups.map((g) => g.id);
  const teams = db.select().from(schema.teams).all().filter((t) => gids.includes(t.groupId));
  const findTeam = (name: string) => { const n = norm(name); return teams.find((t) => norm(t.name) === n) ?? teams.find((t) => norm(t.name).includes(n) || n.includes(norm(t.name))); };
  const findPlayer = (teamId: number, given: string, surname: string) => {
    const squad = db.select().from(schema.players).where(eq(schema.players.teamId, teamId)).all();
    return squad.find((x) => norm(x.surname) === norm(surname) && (norm(x.name) === norm(given) || norm(x.name).split(" ")[0] === norm(given).split(" ")[0]))
      ?? squad.find((x) => norm(x.surname) === norm(surname));
  };
  const addPlayer = (teamId: number, given: string, surname: string) => {
    const ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, teamId), like(schema.players.surname, "Jugador %"))).orderBy(desc(schema.players.id)).get();
    if (ph) { db.update(schema.players).set({ surname, name: given, dorsal: null }).where(eq(schema.players.id, ph.id)).run(); return { ...ph, surname, name: given }; }
    const [np] = db.insert(schema.players).values({ teamId, surname, name: given, position: "MIG", registeredAt: REGISTERED }).returning().all();
    return np;
  };

  for (const [team, old, given, surname] of FIX) {
    const t = findTeam(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const p = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all().find((x) => norm(x.surname).includes(norm(old)));
    if (p) { db.update(schema.players).set({ name: given, surname }).where(eq(schema.players.id, p.id)).run(); console.log(`✓ ${t.name}: ${p.surname}, ${p.name} → ${surname}, ${given}`); }
  }
  let added = 0, skipped = 0;
  for (const [team, list] of Object.entries(NEW)) {
    const t = findTeam(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    for (const full of list) {
      const [given, surname] = full.split("|").map((x) => x.trim());
      if (findPlayer(t.id, given, surname)) { skipped++; continue; }
      addPlayer(t.id, given, surname); added++; console.log(`  + ${surname}, ${given} (${t.name})`);
    }
  }
  console.log(`✓ ${added} jugadors afegits, ${skipped} ja existien`);

  let goals = 0;
  for (const [team, full, n] of GOALS) {
    const t = findTeam(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const [given, surname] = full.split("|").map((x) => x.trim());
    let p = findPlayer(t.id, given, surname);
    if (!p) { p = addPlayer(t.id, given, surname); console.log(`  + ${surname}, ${given} (${t.name})`); }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, t.groupId), eq(schema.rounds.number, ROUND))).get()!;
    const m = db.select().from(schema.matches).where(eq(schema.matches.roundId, r.id)).all().find((x) => x.homeId === t.id || x.awayId === t.id);
    if (!m || m.status !== "played") { console.log(`✗ no played J${ROUND} match for ${t.name}`); continue; }
    const have = db.select().from(schema.events).where(and(eq(schema.events.matchId, m.id), eq(schema.events.playerId, p.id))).all().filter((e) => e.type === "gol" || e.type === "gol_pen").length;
    for (let i = have; i < n; i++) { db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type: "gol", minute: null, sort: 100 + i }).run(); goals++; }
  }
  console.log(`✓ ${goals} gols afegits a les actes de la J${ROUND}`);
}
main();
