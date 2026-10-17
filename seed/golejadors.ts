/* Top-scorers table update (after J5): add new players, fix names, and record J5 goals as match events.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/golejadors.ts
   Idempotent: players matched by surname; goal events only topped up to the expected count. */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

const ROUND = 6;
const REGISTERED = "2026-10-10";
// team → [surname-substring to find, new given, new surname]
const FIX: [string, string, string, string][] = [
  ["CF Torderenc", "Núñez López", "Santiago", "Muñoz López"],
];
// team → "Given|Surnames" (new players)
const NEW: Record<string, string[]> = {
  "CE l'Aigüeta": ["Soufian|El Aissaoui"],
  "Athlètic Can Borell": ["Lucas|Zambotti Cruz"],
  "Restaurant Amura": ["El Mehdi|Zizi"],
  "Veterans Bordils-Flaçà": ["Eduard|Fernández Gómez"],
  "FC Honduras Figueres": ["Andy|Correa Betancourt", "Edwin|Archaga Zúñiga"],
  "Veterans Ath. Hostalric": ["Lluc|Armengol Vives"],
  "Veterans CF Lloret": ["Jhon H.|Valencia Montaño"],
  "EF Maçanet": ["Silvestre|Benítez Santiago"],
  "FC Palafrugell Veterans": ["Jordi|Chacón González"],
  "Racing Blanenc B": ["Andrés|Encisa Green"],
  "Veterans Sant Andreu": ["Marc|Pintu Pagès"],
  "CF Torderenc": ["Bruno Pablo|Ortiz", "Sergio|Platero Molina"],
  "Atlético Empuriabrava": ["Luis Miguel|Gómez"],
  "Veterans d'Arbúcies": ["Guillem|Pujolràs Casadesús", "Adoni A.|Pastrana Rodríguez"],
  "UE Comacros Veterans A": ["Wilmer A.|Rosales Espinoza"],
  "UE Comacros Veterans B": ["Jerson P.|Galindo Castillo", "Walter|Santos Munguia"],
  "Anglès Huellas Colombia": ["Jaruy|Torres Angulo", "Mihai|Leonardion"],
  "Majestic FC": ["David J.|Cáceres Maradiaga"],
  "Veterans La Batllòria": ["Sergi|Corbacho Roldán", "Luis|López García"],
  "Real Guíxols FC": ["Isiaka|Gary", "Bilal|El Yamlahi El Imlahi"],
  "FVB Vilobí": ["Ibraima|Saho Saho"],
  "Vet. Sporting Vidrerenca": ["Alejandro|Bautista García"],
};
// J6 goals: team, "Given|Surnames", goals in that match
const GOALS: [string, string, number][] = [
  ["Athlètic Can Borell", "Lucas|Zambotti Cruz", 2],
  ["Veterans Bordils-Flaçà", "Jaume|Furriols Franco", 2], ["Veterans Bordils-Flaçà", "Jorge|Marques Rebelo", 3], ["Veterans Bordils-Flaçà", "Eduard|Fernández Gómez", 1],
  ["CE l'Aigüeta", "Soufian|El Aissaoui", 1],
  ["FC Palafrugell Veterans", "Jordi|Chacón González", 1],
  ["Restaurant Amura", "El Mehdi|Zizi", 1],
  ["CF Torderenc", "Santiago|Muñoz López", 2], ["CF Torderenc", "Bruno Pablo|Ortiz", 2], ["CF Torderenc", "Sergio|Platero Molina", 1],
  ["Esportiu Bonmatí", "Robert|Carbó Lloveras", 1],
  ["FC Honduras Figueres", "Fabricio|Escoto Olivera", 3], ["FC Honduras Figueres", "Andy|Correa Betancourt", 1], ["FC Honduras Figueres", "Edwin|Archaga Zúñiga", 1],
  ["Veterans Sant Antoni", "Julio C.|Zapata Ramírez", 2], ["Veterans Sant Antoni", "Ismael|Jiménez Vega", 1],
  ["CF Fogars Veterans", "Ievgen|Zinchenko", 1],
  ["Veterans Ath. Hostalric", "Lluc|Armengol Vives", 1],
  ["Veterans Sant Andreu", "Eduard|Viera da Silva", 1], ["Veterans Sant Andreu", "Marc|Pintu Pagès", 1],
  ["EF Maçanet", "David|Franco Guijo", 2], ["EF Maçanet", "Silvestre|Benítez Santiago", 2], ["EF Maçanet", "Victor|Rivas Ávila", 1], ["EF Maçanet", "Spencer Lee|Albert Croft", 1],
  ["Veterans CF Lloret", "Javier|Martínez Mejía", 1], ["Veterans CF Lloret", "Jhon H.|Valencia Montaño", 1],
  ["Racing Blanenc B", "Andrés|Encisa Green", 1],
  ["CE Sant Hilari-Font Vella", "David|Bayés García", 2],
  ["Majestic FC", "Mamadou|Maneh Dansira", 2], ["Majestic FC", "David J.|Cáceres Maradiaga", 2],
  ["FVB Vilobí", "Ibraima|Saho Saho", 1],
  ["Inter Lloret", "Dany|Almendares Ramos", 1],
  ["Veterans CF Sils", "Víctor|Alejo Fernández", 2], ["Veterans CF Sils", "Gerard|González Martínez", 1],
  ["Real Guíxols FC", "Ismail|Chagrani Lemallen", 1], ["Real Guíxols FC", "Mohamed|Koubaa", 1], ["Real Guíxols FC", "Isiaka|Gary", 1], ["Real Guíxols FC", "Bilal|El Yamlahi El Imlahi", 1],
  ["UE Comacros Veterans B", "Jerson P.|Galindo Castillo", 1], ["UE Comacros Veterans B", "Walter|Santos Munguia", 1],
  ["Vet. Sporting Vidrerenca", "Alejandro|Villaverde Pérez", 1], ["Vet. Sporting Vidrerenca", "Aarón|España Jiménez", 1], ["Vet. Sporting Vidrerenca", "Alejandro|Bautista García", 1],
  ["UE Comacros Veterans A", "Jonhy M.|Galeano Cruz", 1], ["UE Comacros Veterans A", "Wilmer A.|Rosales Espinoza", 1],
  ["Sàbat Veterans", "José|Tolmo García", 1],
  ["Veterans La Batllòria", "Roger|Gil Balanyà", 1], ["Veterans La Batllòria", "Sergi|Corbacho Roldán", 1], ["Veterans La Batllòria", "Luis|López García", 1],
  ["Anglès Huellas Colombia", "Juan|González Vélez", 1], ["Anglès Huellas Colombia", "Jaruy|Torres Angulo", 3], ["Anglès Huellas Colombia", "Mihai|Leonardion", 1],
  ["Veterans Pontenc", "Rubén|Jiménez González", 1], ["Veterans Pontenc", "Marcos Daniel|Spinela", 1],
  ["Atlético Empuriabrava", "Luis Miguel|Gómez", 1],
  ["Veterans d'Arbúcies", "Guillem|Pujolràs Casadesús", 3], ["Veterans d'Arbúcies", "Adoni A.|Pastrana Rodríguez", 1],
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
