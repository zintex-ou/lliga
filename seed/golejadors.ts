/* Add players named in the league's top-scorers table to their squads (no goals — those are per match).
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/golejadors.ts
   Idempotent: a player whose surname already exists in the squad is skipped. */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

// team → "Given|Surnames"
const DATA: Record<string, string[]> = {
  "CE l'Aigüeta": ["Bonkó|Sidibeh", "Cristóbal|Posadas Puerta", "Xavier|Alventosa Coll", "Àlex|Gamero Raya"],
  "Veterans Alt Empordà": ["Jordi|Font Almenares"],
  "Athlètic Can Borell": ["Damian|Antonelli", "Ariel|Purificaçao da Silva"],
  "Restaurant Amura": ["Mohamed|Boussif Bilal", "Jamal|Karabila", "Àlex|Carrasquilla Rico", "Kamal|Bernichi", "Eder|Araujo Hernández", "Noureddine|Gairane"],
  "Esportiu Bonmatí": ["Robert|Carbó Lloveras", "Daniel A.|Toala Rosales", "David|Ramos Colina", "Bayron|Ramos Colina", "Gerard|Juny Roura"],
  "Veterans Bordils-Flaçà": ["Jaume|Furriols Franco", "Daniel|Hernández Tora", "Pau|Albó Carles", "José|Ramírez Martín"],
  "Veterans CE Farners": ["Jorge M.|Vera Matto"],
  "CF Fogars Veterans": ["Alexander|Andreev", "Jhoan|Cruz González", "Josep|Coloma Martos", "Jesús|Zamora Navarro", "Franco|Dacjhonny"],
  "FC Honduras Figueres": ["Ricardo|Mejias Flores", "Fabricio|Escoto Olivera", "Carlos|Astorquiza Bustos", "Johan|Mejía Flores"],
  "Veterans Ath. Hostalric": ["Khalid|El Youssefi", "Adrià|González Aparicio", "Jassey|Sheriffo", "Issam|Aida"],
  "Veterans CF Lloret": ["Héctor|Montaño Arboleda", "Javier|Martínez Mejía", "Rubén|Durán Ayala"],
  "EF Maçanet": ["Victor|Rivas Ávila", "David|Franco Guijo"],
  "FC Palafrugell Veterans": ["Adrià|Ortega Cabaño", "Álvaro|Torres Pérez", "Alejandro|Ordán", "Rubén|Barrón"],
  "Racing Blanenc B": ["José|Flores López", "Cristian|Sánchez Amaya", "Kevin|Medina Mena"],
  "Veterans Sant Antoni": ["Diego Ezequiel|Ghiretti", "Mohamed|Zitouni El Hor", "Mohamed|Driouech Lasri", "Julio C.|Zapata Ramírez"],
  "Veterans Sant Andreu": ["José|Santiago Martínez", "Eduard|Viera da Silva", "Josep|Romaguera Mora"],
  "CF Torderenc": ["Ismael|Cabrera Gómez", "Brian|Lucena Rodríguez", "Santiago|Núñez López", "Didier|Echevarría Rincón"],
  "CEF Veterans SFG": ["Naoufal|Arjaz", "Denilson|Andrade López", "Matías|Krukoshansky"],
};
const REGISTERED = "2026-09-19";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function main() {
  const season = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get()!;
  const groups = db.select().from(schema.groups).where(eq(schema.groups.seasonId, season.id)).all();
  const gids = groups.map((g) => g.id);
  const teams = db.select().from(schema.teams).all().filter((t) => gids.includes(t.groupId));
  const find = (name: string) => { const n = norm(name); return teams.find((t) => norm(t.name) === n) ?? teams.find((t) => norm(t.name).includes(n) || n.includes(norm(t.name))); };
  let added = 0, skipped = 0;
  for (const [team, list] of Object.entries(DATA)) {
    const t = find(team); if (!t) { console.log(`✗ team ${team}`); continue; }
    for (const full of list) {
      const [given, surname] = full.split("|").map((x) => x.trim());
      const squad = db.select().from(schema.players).where(eq(schema.players.teamId, t.id)).all();
      if (squad.find((x) => norm(x.surname) === norm(surname) && (norm(x.name) === norm(given) || norm(x.name).split(" ")[0] === norm(given).split(" ")[0]))) { skipped++; continue; }
      const ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, t.id), like(schema.players.surname, "Jugador %"))).orderBy(desc(schema.players.id)).get();
      if (ph) db.update(schema.players).set({ surname, name: given, dorsal: null }).where(eq(schema.players.id, ph.id)).run();
      else db.insert(schema.players).values({ teamId: t.id, surname, name: given, position: "MIG", registeredAt: REGISTERED }).run();
      added++; console.log(`  + ${surname}, ${given} (${t.name})${ph ? "" : " [nou]"}`);
    }
  }
  console.log(`✓ ${added} afegits, ${skipped} ja existien`);
}
main();
