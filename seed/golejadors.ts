/* Top-scorers table update (after J5): add new players, fix names, and record J5 goals as match events.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/golejadors.ts
   Idempotent: players matched by surname; goal events only topped up to the expected count. */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

const ROUND = 8; // default; GOALS rows carry their own round
const REGISTERED = "2026-10-24";
// team → [surname-substring to find, new given, new surname]
const FIX: [string, string, string, string][] = [];
// team → "Given|Surnames" (new players without goals yet in a played match)
const NEW: Record<string, string[]> = {
  "UCE Celrà": ["Víctor|Corona Martín", "Mohamed|Camara", "Yunusa|Cesay"],
  "Atlético Empuriabrava": ["Marc|Bolívar Pascual", "Agustín|Sueldo Nicolás"],
};
// new squad members with details: team, given, surname, dob, position
const ADD_PLAYERS: [string, string, string, string, string][] = [["CF Fogars Veterans", "Mykhailo", "Tiurin", "1982-04-17", "MIG"]];
// goals: round, team, "Given|Surnames", goals in that match
const GOALS: [number, string, string, number][] = [
  [7, "Atlético Empuriabrava", "Ayoub|M'Zionka", 3],
  [7, "Atlético Empuriabrava", "Hicham|Al Hamidi", 2],
  [7, "Atlético Empuriabrava", "Aitor|Reyes Sánchez", 1],
  [7, "Atlético Empuriabrava", "Luis Miguel|Gómez", 1],
  [7, "CE Anglès", "Grodsvin|Morazán Matute", 2],
  [7, "CE Anglès", "Redouan|Etabrach", 1],
  [7, "CE Anglès", "Brayan|Espinozo Ramírez", 1],
  [8, "CE Anglès", "Billy A.|Arriaga Martínez", 1],
  [7, "Veterans d'Arbúcies", "Daniel|Miranda Muñoz", 1],
  [7, "UE Comacros Veterans A", "Jonhy M.|Galeano Cruz", 2],
  [8, "UE Comacros Veterans A", "Jonhy M.|Galeano Cruz", 2],
  [8, "UE Comacros Veterans A", "Wilmer A.|Rosales Espinoza", 4],
  [7, "UE Comacros Veterans B", "Walter|Santos Munguia", 1],
  [7, "UE Comacros Veterans B", "Nelson|Durón Paz", 1],
  [8, "UE Comacros Veterans B", "Leonel|Cerrato Cartagena", 1],
  [7, "Anglès Huellas Colombia", "Golbery|Sinisterra Moreno", 2],
  [7, "Anglès Huellas Colombia", "Jampier|Riascos Mosquera", 1],
  [7, "Anglès Huellas Colombia", "José M.|Estrada Benítez", 1],
  [7, "Inter Lloret", "Dany|Almendares Ramos", 1],
  [7, "Inter Lloret", "Joubair|Makfaoui", 3],
  [8, "Inter Lloret", "Darwin Dante|Triana", 1],
  [8, "Inter Lloret", "Nicolás|Aravena Gatica", 1],
  [7, "Veteranos El Barrio", "Cristian|Rodríguez Jiménez", 4],
  [7, "Veteranos El Barrio", "Daniel|Albalá Angulo", 2],
  [8, "Veteranos El Barrio", "Rafael|Ayala Morales", 1],
  [8, "Veteranos El Barrio", "Pere|Cuéllar Jiménez", 1],
  [8, "Veteranos El Barrio", "Ferran|Segura Olivares", 1],
  [7, "Veterans La Batllòria", "Raúl|Alcolea Cárdenas", 2],
  [8, "Veterans La Batllòria", "Fernando|Segura Sevilla", 1],
  [7, "Veterans Pontenc", "Derek|Jiménez Gallardo", 2],
  [8, "Veterans Pontenc", "Derek|Jiménez Gallardo", 1],
  [8, "Veterans Pontenc", "Brian J.|Elvir Hernández", 1],
  [7, "Real Guíxols FC", "Mohamed|Koubaa", 1],
  [8, "Real Guíxols FC", "Mohamed|Koubaa", 1],
  [8, "Real Guíxols FC", "Abdelkarim|Aadiddou", 1],
  [7, "Sàbat Veterans", "José|Tolmo García", 2],
  [8, "Sàbat Veterans", "Farah|Mjimar El Massadi", 1],
  [8, "Sàbat Veterans", "Bernat|Vilarrubí Feliu", 1],
  [8, "Sàbat Veterans", "Aitor|Sánchez Gómez", 1],
  [8, "Sàbat Veterans", "David|Agüero de Pablo", 1],
  [7, "CE Sant Hilari-Font Vella", "Leandro|Lisboa dos Santos", 1],
  [8, "CE Sant Hilari-Font Vella", "Àngel|Bruguerola López", 1],
  [8, "CE Sant Hilari-Font Vella", "Gerard|Tornès Mayorga", 1],
  [7, "Veterans CF Sils", "Gerard|González Martínez", 1],
  [8, "Veterans CF Sils", "Gerard|González Martínez", 1],
  [8, "Veterans CF Sils", "Cristian A.|Hernández Larroquete", 2],
  [8, "Veterans CF Sils", "Alberto|Esteo Expósito", 1],
  [8, "Veterans CF Sils", "Carlos|Sillero Ruiz", 1],
  [8, "Veterans CF Sils", "Marius Ionut|Tanase", 1],
  [7, "FVB Vilobí", "Àlex|Zamora Lazo", 2],
  [8, "FVB Vilobí", "Àlex|Zamora Lazo", 1],
  [8, "FVB Vilobí", "Ibraima|Saho Saho", 1],
  [8, "FVB Vilobí", "Adrià|Díaz Trillo", 1],
  [8, "FVB Vilobí", "Edgar|Trigueros Campos", 1],
  [7, "Vet. Sporting Vidrerenca", "Eloi|Masbernat Martínez", 1],
  [8, "Vet. Sporting Vidrerenca", "Eloi|Masbernat Martínez", 1],
  [8, "Vet. Sporting Vidrerenca", "Issou|Doumbia", 1],
  [8, "CE l'Aigüeta", "Bonkó|Sidibeh", 1],
  [8, "Veterans Alt Empordà", "Leandro|Marí", 1],
  [8, "Veterans Alt Empordà", "Jeisson|Leves Cuadrado", 1],
  [7, "Athlètic Can Borell", "Gabriel Ernesto|Guidi", 1],
  [7, "Athlètic Can Borell", "Raúl|Muñoz Carbó", 1],
  [7, "Athlètic Can Borell", "José I.|Mendieta Díaz", 1],
  [8, "Athlètic Can Borell", "Kamil|Katciga Calderón", 1],
  [8, "Restaurant Amura", "Mohamed|Boussif Bilal", 1],
  [8, "Restaurant Amura", "El Mehdi|Zizi", 2],
  [8, "Restaurant Amura", "Rachid|Boussif", 1],
  [7, "Esportiu Bonmatí", "Robert|Carbó Lloveras", 1],
  [7, "Esportiu Bonmatí", "Bayron|Ramos Colina", 1],
  [8, "Esportiu Bonmatí", "Cristian|Chincolla Díaz", 1],
  [8, "Esportiu Bonmatí", "Luis F.|Mera León", 1],
  [7, "Veterans Bordils-Flaçà", "Jaume|Furriols Franco", 3],
  [7, "Veterans Bordils-Flaçà", "Jorge|Marques Rebelo", 1],
  [7, "Veterans Bordils-Flaçà", "José|Ramírez Martín", 1],
  [7, "Veterans Bordils-Flaçà", "Jordi|Figueras Guixeras", 1],
  [8, "Veterans Bordils-Flaçà", "Ángel|Pichel Becerra", 1],
  [8, "Veterans Bordils-Flaçà", "David|Urtos Quintana", 1],
  [8, "Veterans Bordils-Flaçà", "Àngel|Arnau Cortés", 1],
  [7, "Veterans CE Farners", "Ayoub|Jijane", 3],
  [8, "Veterans CE Farners", "Emanuel|Amherdt", 1],
  [8, "Veterans CE Farners", "Franco Nauel|Ramírez", 1],
  [7, "CF Fogars Veterans", "Alexander|Andreev", 1],
  [8, "CF Fogars Veterans", "Alexander|Andreev", 3],
  [7, "CF Fogars Veterans", "Óscar|Ballesté Planas", 1],
  [8, "CF Fogars Veterans", "Óscar|Ballesté Planas", 1],
  [8, "CF Fogars Veterans", "Yoines|Chaara", 1],
  [7, "FC Honduras Figueres", "Fabricio|Escoto Olivera", 1],
  [8, "FC Honduras Figueres", "Mouslih|Kilou", 4],
  [8, "FC Honduras Figueres", "Edwin|Archaga Zúñiga", 1],
  [8, "FC Honduras Figueres", "Cristofer|Rubio Rubio", 1],
  [7, "Veterans CF Lloret", "Héctor|Montaño Arboleda", 2],
  [8, "Veterans CF Lloret", "Héctor|Montaño Arboleda", 3],
  [8, "Veterans CF Lloret", "Jhon H.|Valencia Montaño", 1],
  [7, "EF Maçanet", "Cristian|Llanos Cabezas", 2],
  [7, "EF Maçanet", "Víctor|Camacho Coll", 1],
  [8, "EF Maçanet", "Daniel Francisco|Perea", 1],
  [7, "FC Palafrugell Veterans", "Alejandro|Jordán Moreno", 3],
  [7, "FC Palafrugell Veterans", "Khalil|Daia Laasal", 2],
  [7, "FC Palafrugell Veterans", "Jordi|Chacón González", 1],
  [7, "Racing Blanenc B", "Kevin|Medina Mena", 2],
  [8, "Racing Blanenc B", "Liridon|Bislimi", 1],
  [7, "Veterans Sant Antoni", "Diego Ezequiel|Ghiretti", 2],
  [8, "Veterans Sant Antoni", "Diego Ezequiel|Ghiretti", 1],
  [8, "Veterans Sant Antoni", "Michael|Beaussant", 2],
  [8, "Veterans Sant Antoni", "Neil|Dollochin", 1],
  [7, "Veterans Sant Andreu", "Jonatan|Mures Margarit", 4],
  [7, "Veterans Sant Andreu", "José|Santiago Martínez", 1],
  [7, "Veterans Sant Andreu", "Francisco L.|Muñoz García", 1],
  [7, "Veterans Sant Andreu", "Sergi|García Fàbregas", 1],
  [7, "CF Torderenc", "Brian|Lucena Rodríguez", 3],
  [8, "CF Torderenc", "Brian|Lucena Rodríguez", 1],
  [8, "CF Torderenc", "Cristian|Álvarez Díaz", 1],
  [8, "CF Torderenc", "Daniel|López Gallego", 1],
  [7, "CEF Veterans SFG", "Mohamed|Al Haddadi", 3],
  [8, "CEF Veterans SFG", "Mohamed|Al Haddadi", 2]
];
// assists: round, team, scorer "Given|Surnames", assister "Given|Surnames", how many of the scorer's goals in that match
const ASSISTS: [number, string, string, string, number][] = [
  [7, "CF Fogars Veterans", "Alexander|Andreev", "Miquel|Ballesté Da Silva", 1],
  [7, "CF Fogars Veterans", "Óscar|Ballesté Planas", "Miquel|Ballesté Da Silva", 1],
  [8, "CF Fogars Veterans", "Alexander|Andreev", "Viacheslav|Hlot", 1],
  [8, "CF Fogars Veterans", "Alexander|Andreev", "Miquel|Ballesté Da Silva", 1],
  [8, "CF Fogars Veterans", "Óscar|Ballesté Planas", "Miquel|Ballesté Da Silva", 1],
];
// goal minutes: round, team, scorer "Given|Surnames", minutes of that player's goals in that match (in order)
const MINUTES: [number, string, string, number[]][] = [
  [8, "CF Fogars Veterans", "Alexander|Andreev", [24, 45, 80]],
  [8, "CF Fogars Veterans", "Yoines|Chaara", [66]],
  [8, "CF Fogars Veterans", "Óscar|Ballesté Planas", [75]],
  [8, "Esportiu Bonmatí", "Cristian|Chincolla Díaz", [13]],
  [8, "Esportiu Bonmatí", "Luis F.|Mera León", [44]],
];
// lineups: round, team, list of "Given|Surnames" (titulars first, then after "|SUPLENTS|" the bench)
const LINEUPS: [number, string, string[]][] = [
  [7, "CF Fogars Veterans", ["Daniel|Lopez Fernandez", "Dmytro|Stoiachenko", "Carlos|Ortiz Ortiz", "Daniel Alfonzo|Delgado Baez", "Jhoan Andres|Cruz Gonzalez", "Miquel|Balleste Da Silva", "Jesus Enrique|Zamora Navarro", "Viacheslav|Hlot", "Franco|Rodríguez Delyhonny", "Josep Lluis|Coloma Martos", "Alexander|Andreev",
    "|SUPLENTS|", "Cristian Ezequiel|Martínez", "Oscar|Balleste Planas", "Anton|Zelenov", "Abdelaziz|Errouchani", "Francisco|Segui Martin"]],
  [8, "CF Fogars Veterans", ["Ievgen|Zinchenko", "Dmytro|Stoiachenko", "Vitalii|Farafontov", "Daniel Alfonzo|Delgado Baez", "Viacheslav|Hlot", "Miquel|Balleste Da Silva", "Jhoan Andres|Cruz Gonzalez", "Josep Lluis|Coloma Martos", "Alexander|Andreev", "Oscar|Balleste Planas", "Franco|Rodríguez Delyhonny",
    "|SUPLENTS|", "Abdelaziz|Errouchani", "Francisco|Segui Martin", "Mykhailo|Tiurin", "Younes|Chaara", "Cristian Ezequiel|Martínez", "Denys|Reutsa"]],
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
  for (const [team, given, surname, dob, position] of ADD_PLAYERS) {
    const t = findTeam(team); if (!t) continue;
    const ex = findPlayer(t.id, given, surname);
    if (ex) { db.update(schema.players).set({ dob, position }).where(eq(schema.players.id, ex.id)).run(); continue; }
    const np = addPlayer(t.id, given, surname); db.update(schema.players).set({ dob, position }).where(eq(schema.players.id, np.id)).run(); console.log(`  + ${surname}, ${given} (${t.name})`);
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
  for (const [rn, team, full, n] of GOALS) {
    const t = findTeam(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const [given, surname] = full.split("|").map((x) => x.trim());
    let p = findPlayer(t.id, given, surname);
    if (!p) { p = addPlayer(t.id, given, surname); console.log(`  + ${surname}, ${given} (${t.name})`); }
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, t.groupId), eq(schema.rounds.number, rn))).get()!;
    const m = db.select().from(schema.matches).where(eq(schema.matches.roundId, r.id)).all().find((x) => x.homeId === t.id || x.awayId === t.id);
    if (!m || m.status !== "played") { console.log(`✗ no played J${rn} match for ${t.name}`); continue; }
    const have = db.select().from(schema.events).where(and(eq(schema.events.matchId, m.id), eq(schema.events.playerId, p.id))).all().filter((e) => e.type === "gol" || e.type === "gol_pen").length;
    for (let i = have; i < n; i++) { db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type: "gol", minute: null, sort: 100 + i }).run(); goals++; }
  }
  console.log(`✓ ${goals} gols afegits a les actes`);
  const matchFor = (rn: number, teamId: number, groupId: number) => {
    const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, groupId), eq(schema.rounds.number, rn))).get()!;
    return db.select().from(schema.matches).where(eq(schema.matches.roundId, r.id)).all().find((x) => x.homeId === teamId || x.awayId === teamId);
  };
  let assists = 0;
  for (const [rn, team, scorer, assister, n] of ASSISTS) {
    const t = findTeam(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const [sg, ss] = scorer.split("|").map((x) => x.trim()); const [ag, as] = assister.split("|").map((x) => x.trim());
    const sp = findPlayer(t.id, sg, ss); let ap = findPlayer(t.id, ag, as);
    if (!sp) { console.log(`✗ golejador ${scorer} (${t.name})`); continue; }
    if (!ap) { ap = addPlayer(t.id, ag, as); console.log(`  + ${as}, ${ag} (${t.name})`); }
    const m = matchFor(rn, t.id, t.groupId); if (!m) { console.log(`✗ no J${rn} match for ${t.name}`); continue; }
    const evs = db.select().from(schema.events).where(and(eq(schema.events.matchId, m.id), eq(schema.events.playerId, sp.id))).all().filter((e) => (e.type === "gol" || e.type === "gol_pen") && !e.assistId).slice(0, n);
    for (const e of evs) { db.update(schema.events).set({ assistId: ap.id }).where(eq(schema.events.id, e.id)).run(); assists++; }
  }
  console.log(`✓ ${assists} assistències`);
  for (const [rn, team, scorer, mins] of MINUTES) {
    const t = findTeam(team); if (!t) continue;
    const [sg, ss] = scorer.split("|").map((x) => x.trim()); const sp = findPlayer(t.id, sg, ss); if (!sp) { console.log(`✗ ${scorer}`); continue; }
    const m = matchFor(rn, t.id, t.groupId); if (!m) continue;
    const evs = db.select().from(schema.events).where(and(eq(schema.events.matchId, m.id), eq(schema.events.playerId, sp.id))).all().filter((e) => e.type === "gol" || e.type === "gol_pen").sort((a, b) => a.id - b.id);
    evs.forEach((e, i) => { if (mins[i] != null) db.update(schema.events).set({ minute: mins[i], sort: mins[i] }).where(eq(schema.events.id, e.id)).run(); });
  }
  let apps = 0;
  for (const [rn, team, names] of LINEUPS) {
    const t = findTeam(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    const m = matchFor(rn, t.id, t.groupId); if (!m) { console.log(`✗ no J${rn} match for ${t.name}`); continue; }
    let role = "titular";
    for (const full of names) {
      if (full === "|SUPLENTS|") { role = "suplent"; continue; }
      const [g, sn] = full.split("|").map((x) => x.trim());
      let p = findPlayer(t.id, g, sn); if (!p) { p = addPlayer(t.id, g, sn); console.log(`  + ${sn}, ${g} (${t.name})`); }
      const ex = db.select().from(schema.appearances).where(and(eq(schema.appearances.matchId, m.id), eq(schema.appearances.playerId, p.id))).get();
      if (ex) db.update(schema.appearances).set({ role }).where(and(eq(schema.appearances.matchId, m.id), eq(schema.appearances.playerId, p.id))).run();
      else db.insert(schema.appearances).values({ matchId: m.id, playerId: p.id, role, entered: true }).run();
      apps++;
    }
  }
  console.log(`✓ ${apps} alineacions`);
}
main();
