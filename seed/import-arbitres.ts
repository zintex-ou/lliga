/* Idempotent: imports the referee list and the "Arbitratges" page text from the old website. */
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";

const REFS = ["AHSAYANE MONTOYA, Sergio", "AGUADO TARIFA, Manuel", "ARANDA MORENO, Antonio", "ASTUDILLO, Pablo", "BOSCH TELLEZ, Sergi", "ADONIS XARLES, Joan", "EXTREMERA PEÑA, Carles", "EXPÓSITO PEDREGOSA, Carlos", "FIJO, Toni", "GONZÁLEZ AGUILERA, Raúl", "IKANE, Ahmed", "NIERGA GELABERT, Gerard", "PALMA MORENO, Sergio", "QUINTANA LEIRA, Jaume", "RAMÍREZ SANZ, Francisco", "RAMÍREZ SANZ, Miguel", "RIBAS VIZCAINO, Manuel", "RUIZ, Ferran", "SANCES LÓPEZ, Rafael", "SILLERO LÓPEZ, Antonio", "TORRES LUNA, Victoriano"];
const title = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m) => m.toUpperCase());
const existing = new Set(db.select().from(schema.referees).all().map((r) => r.name.toLowerCase()));
let n = 0;
for (const raw of REFS) {
  const [sur, name] = raw.split(",").map((x) => x.trim());
  const full = `${name} ${title(sur)}`;
  if (existing.has(full.toLowerCase())) continue;
  db.insert(schema.referees).values({ name: full, notes: raw.includes("Miguel") ? "President del Col·legi d'Àrbitres" : null }).run(); n++;
}
console.log(`àrbitres afegits: ${n}`);

const BODY = `L'Associació Amics del Futbol Amateur compta, dins la seva organització amb un col·lectiu arbitral propi i col·legiat, destinat a portar a terme la direcció dels partits d'aquestes competicions.

El Col·legi d'Àrbitres és l'òrgan arbitral exclusiu per al Futbol d'Empreses que aplega les persones encarregades d'aquesta indispensable funció.

Els àrbitres assumeixen la responsabilitat i adquireixen l'autoritat que aquesta direcció comporta i per a la qual estan plenament legitimats, potestat que com a únics jutges vàlids dels encontres, queda reflectida i certificada en les corresponents actes que de cada partit se'n deriven. Per aquesta raó els àrbitres han de ser tractats en tot moment amb la corresponent esportivitat, respecte i educació que mereix la seva figura clau en els partits.

El President del Col·legi d'Àrbitres, al marge de coordinar i fer els nomenaments per als partits, és el representant del col·lectiu arbitral que forma part del Comitè de Competició, assistint a totes les reunions que aquest celebra i no podent delegar en ningú més aquesta funció.

Membres del Col·legi d'Àrbitres:
${REFS.map((r) => "· " + r + (r.includes("Miguel") ? " (President)" : "")).join("\n")}`;
const page = db.select().from(schema.pages).where(eq(schema.pages.slug, "arbitratges")).get();
if (page && !page.body) { db.update(schema.pages).set({ body: BODY }).where(eq(schema.pages.slug, "arbitratges")).run(); console.log("pàgina Arbitratges omplerta"); }
