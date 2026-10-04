/* Add players named in the league's top-scorers table to their squads (no goals — those are per match).
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/golejadors.ts
   Idempotent: a player whose surname already exists in the squad is skipped. */
import { db, schema } from "../src/db";
import { eq, and, like, desc } from "drizzle-orm";

// team → "Given|Surnames"
const DATA: Record<string, string[]> = {
  "Atlético Empuriabrava": ["Hicham|Al Hamidi", "Ayoub|M'Zionka", "Aitor|Reyes Sánchez"],
  "CE Anglès": ["Raúl|Morazan Matute", "Nahum|Molina Acosta", "Darwin D.|Lanza Ulloa", "Eduar M.|Cruz Suazo"],
  "Veterans d'Arbúcies": ["Bauba|Balde", "Hugo|Godayol Jorà", "Enric|Almendros Barruenes"],
  "UCE Celrà": ["Nicolae|Chiriac"],
  "UE Comacros Veterans A": ["Marcos J.|Sánchez Ortiz", "Jonhy M.|Galeano Cruz", "Henri L.|Durón García", "Jonathan P.|Bascuñant Salinas"],
  "UE Comacros Veterans B": ["Yareth Ariel|Durón"],
  "Anglès Huellas Colombia": ["Juan|González Vélez", "Rafael|Perdomo López", "Golbery|Sinisterra Moreno", "Jampier|Riascos Mosquera"],
  "Inter Lloret": ["Joubair|Makfaoui", "Gustavo|Garnica", "Dany|Almendares Ramos", "Yassine|Akoudad", "Sebastian R.|Rozas Valencia"],
  "Majestic FC": ["Mamadou|Maneh Dansira", "Carlos Duvan|Moreno Puentes"],
  "Veteranos El Barrio": ["Cristian|Rodríguez Jiménez", "Daniel|Albalá Angulo", "Daniel|Martínez Morales", "Rafael|Ayala Morales", "José|Paz Pérez", "José|Marín Ferrer"],
  "Veterans La Batllòria": ["Sergi|Castellà", "Roger|Gil Balanyà", "Víctor|Campos Samazas"],
  "Veterans Pontenc": ["Rubén|Jiménez González", "Marcos Daniel|Spinela", "Brian J.|Elvir Hernández", "Samuel|Ounam Opeke", "Daniel|Pedraza Tejada", "Said|Zannouti"],
  "Real Guíxols FC": ["Mohamed|Koubaa", "Alberto|Estupiñán González"],
  "Sàbat Veterans": ["Carlos|Fornas de la Torre", "Antonio|Platero Berzal", "Juan|Benítez Oliva", "Cristo A.|Merino Cortés", "Jesús|Martínez Esteban", "Farah|Mjimar El Massadi", "José|Tolmo García"],
  "CE Sant Hilari-Font Vella": ["Àngel|Bruguerola López", "David|Bayés García", "Eloy|García Mas", "Leandro|Lisboa dos Santos", "Enric|Dot Miralpeix", "Carles|Bolaños Montero"],
  "Veterans CF Sils": ["Víctor|Alejo Fernández", "Amine|Bouboos", "Gerard|González Martínez"],
  "FVB Vilobí": ["Iván|González Galán", "Juan J.|Ávila González", "Àlex|Zamora Lazo"],
  "Vet. Sporting Vidrerenca": ["Joel|Hernández Sánchez", "Eloi|Masbernat Martínez", "Aarón|España Jiménez", "Boris|Nadal Cortés"],
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
