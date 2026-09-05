import { cookies } from "next/headers";
import { readSeasonCookie } from "@/lib/stats";

export type Lang = "ca" | "es";

const ca = {
  siteName: "Amics del futbol amateur",
  tagline: "Campionats per a veterans",
  inici: "Inici", lliga: "Lliga", grup: "Grup", normatives: "Normatives", contacte: "Contacte",
  normativa: "Normativa veterans", reglament: "Reglament", arbitratges: "Arbitratges", documentacio: "Documentació", circulars: "Circulars",
  resultats: "Resultats", classificacio: "Classificació", calendari: "Calendari", golejadors: "Golejadors", assistents: "Assistents", sancions: "Sancions",
  properaJornada: "Propera jornada", jornada: "Jornada", ultimaJornada: "Última jornada",
  equips: "equips", jornades: "jornades", temporada: "Temporada",
  equip: "Equip", pj: "PJ", g: "G", e: "E", p: "P", gf: "GF", gc: "GC", dg: "DG", pts: "Pts",
  campio: "Campió", ascens: "Ascens", descens: "Descens", ultim: "Últim classificat",
  clickTeam: "Clica el nom de l'equip per veure la plantilla",
  plantilla: "Plantilla", jugadors: "jugadors", jugador: "Jugador", pos: "Pos", dorsal: "Nº", naixement: "Naixement", edat: "Edat", anys: "anys",
  gols: "Gols", golsPen: "Gols (penal)", ass: "Ass.", grogues: "Grogues", vermelles: "Vermelles", encaixats: "Encaixats", golsEncaixats: "Gols encaixats",
  partits: "Partits", partit: "Partit", min: "Min", targetes: "Targetes",
  POR: "Porter", DEF: "Defensa", MIG: "Migcampista", DAV: "Davanter",
  POR_s: "POR", DEF_s: "DEF", MIG_s: "MIG", DAV_s: "DAV",
  sancionat: "Sancionat", queden: "Queden", quedaPartit: "queda 1 partit", quedenPartits: "queden {n} partits",
  sancio: "Sanció", motiu: "Motiu", sancionatsVigents: "Sancionats vigents", historialSancions: "Historial de sancions",
  falta_joc: "Falta de joc", joc_violent: "Joc violent", antiesportiva: "Conducta antiesportiva", agressio: "Agressió / baralla", acumulacio: "Acumulació de grogues", comite: "Decisió del comitè",
  camp: "Camp", hora: "Hora", horaPerConfirmar: "hora per confirmar", arbitre: "Àrbitre", observacions: "Observacions",
  acta: "Acta", veureActa: "Veure acta", ajornat: "Ajornat", noPresentat: "No presentat",
  titulars: "Titulars", suplents: "Suplents", delegats: "Delegats i tècnics",
  delegat: "Delegat", entrenador: "Entrenador", "delegat-entrenador": "Delegat i entrenador",
  colors: "Colors", poblacio: "Població", aLaLligaDes: "A la lliga des de", informacio: "Informació",
  comunicats: "Comunicats de la lliga", totsElsComunicats: "Tots els comunicats", llegirMes: "Llegir més",
  capJornadaJugada: "Encara no s'ha jugat cap jornada", capResultat: "Sense resultats",
  calNote: "Els partits jugats mostren el resultat; clica un partit per veure l'acta.",
  resNote: "Per defecte es mostra l'última jornada jugada.",
  anterior: "Anterior", seguent: "Següent",
  tornaEquip: "Torna a l'equip", tornaLliga: "Torna a la classificació",
  penal: "penal", pen: "pen.", segonaGroga: "2a groga", vermellaDirecta: "vermella directa",
  documents: "Documents", descarregar: "Descarregar", senseContingut: "Contingut pendent de publicar.",
  peu: "Amics del futbol amateur · Campionats per a veterans",
  admin: "Administració", entrar: "Entrar", sortir: "Sortir",
  golejadorsSub: "Rànquing per grup", sancionsSub: "Targetes i sancionats vigents", calendariSub: "Horaris i camps per jornada", reglamentSub: "Normativa de la lliga",
  forma: "Forma",
  cap: "Cap", jugadorsSancionats: "jugadors sancionats", capSancionat: "Cap jugador sancionat actualment.",
  fitxaDes: "Fitxa des de", baixa: "Baixa",
  arxiu: "Arxiu", actual: "Actual", veureTemporada: "Veure temporada", arxiuBanner: "Estàs consultant l'arxiu de la temporada", tornaActual: "Torna a la temporada actual", temporades: "Temporades",
  cartes: "Cartes", taula: "Taula", tancar: "Tancar",
  records: "Rècords", totsElsTemps: "Tots els temps", campions: "Campions", enCurs: "en curs",
  recTopScorer: "Màxims golejadors", recHatTricks: "Hat-tricks (3+ gols en un partit)", recBestGk: "Millor porter (gols encaixats per partit)", recCleanSheets: "Porteries a zero",
  recBiggestWin: "Victòria més àmplia", recMostGoalsMatch: "Partit amb més gols", recUnbeaten: "Ratxa més llarga sense perdre", recWinStreak: "Ratxa més llarga de victòries",
  recAttack: "Millor atac (gols a favor)", recDefense: "Millor defensa (gols encaixats per partit)", recMostApps: "Més partits jugats", recCards: "Més targetes",
  porteriaZero: "porteries a zero", min3: "Cal un mínim de 3 partits.",
  forma5: "Forma", ratxa: "Ratxa actual", ratxaW: "victòries seguides", ratxaU: "partits sense perdre", ratxaL: "derrotes seguides", casa: "Casa", fora: "Fora", millorVictoria: "Millor victòria", pitjorDerrota: "Pitjor derrota", golsPerPartit: "Gols per partit",
  h2h: "Cara a cara", enfrontaments: "enfrontaments", victories: "victòries", empats: "empats", historial: "Historial",
  subscriuCalendari: "Afegir al calendari del mòbil", descarregarIcs: "Descarregar .ics", imprimirPdf: "Imprimir / desar com a PDF", pdf: "PDF",
  galeria: "Galeria de fotos", cerca: "Cercar jugador", cercaPh: "Cognom o nom…", resultatsCerca: "Resultats de la cerca", capResultatCerca: "Cap jugador trobat.",
  avisGrogues: "A una groga de la sanció", proximPartit: "Proper partit",
  desenvolupatPer: "Desenvolupat per",
  valoracio: "Valoració", valoraArbitre: "Valora l'arbitratge d'aquest partit (1 = molt malament · 5 = excel·lent)", actualitzar: "Actualitzar", presentarProtesta: "Presentar una protesta", protestaCheck: "Presento una protesta formal sobre l'arbitratge", protestaPh: "Motiu de la protesta (només el veu el comitè d'àrbitres)", protestaPresentada: "Protesta presentada",
  reportError: "Hi ha un error a l'acta?", reportPh: "Explica què no és correcte (resultat, gol, targeta…)", reportContact: "Nom / telèfon (opcional)", enviar: "Enviar", modeFosc: "Mode fosc",
  pushOn: "Notificacions activades", pushOff: "Avisa'm dels partits", pushOffGroup: "Avisa'm dels resultats del Grup", pushUnsupported: "El navegador no admet notificacions (a l'iPhone cal afegir el web a la pantalla d'inici)", pushHint: "Rep els resultats i els canvis d'horari al mòbil:",
  partitsEndarrerits: "Partits endarrerits i ajornats", dataPerConfirmar: "data per confirmar", aniversaris: "Aniversaris de la setmana", avui: "avui", ahir: "ahir", dema: "demà",
};
const es: typeof ca = {
  siteName: "Amics del futbol amateur",
  tagline: "Campionats per a veterans",
  inici: "Inicio", lliga: "Liga", grup: "Grupo", normatives: "Normativas", contacte: "Contacto",
  normativa: "Normativa veteranos", reglament: "Reglamento", arbitratges: "Arbitrajes", documentacio: "Documentación", circulars: "Circulares",
  resultats: "Resultados", classificacio: "Clasificación", calendari: "Calendario", golejadors: "Goleadores", assistents: "Asistentes", sancions: "Sanciones",
  properaJornada: "Próxima jornada", jornada: "Jornada", ultimaJornada: "Última jornada",
  equips: "equipos", jornades: "jornadas", temporada: "Temporada",
  equip: "Equipo", pj: "PJ", g: "G", e: "E", p: "P", gf: "GF", gc: "GC", dg: "DG", pts: "Pts",
  campio: "Campeón", ascens: "Ascenso", descens: "Descenso", ultim: "Último clasificado",
  clickTeam: "Haz clic en el nombre del equipo para ver la plantilla",
  plantilla: "Plantilla", jugadors: "jugadores", jugador: "Jugador", pos: "Pos", dorsal: "Nº", naixement: "Nacimiento", edat: "Edad", anys: "años",
  gols: "Goles", golsPen: "Goles (penalti)", ass: "As.", grogues: "Amarillas", vermelles: "Rojas", encaixats: "Encajados", golsEncaixats: "Goles encajados",
  partits: "Partidos", partit: "Partido", min: "Min", targetes: "Tarjetas",
  POR: "Portero", DEF: "Defensa", MIG: "Centrocampista", DAV: "Delantero",
  POR_s: "POR", DEF_s: "DEF", MIG_s: "MED", DAV_s: "DEL",
  sancionat: "Sancionado", queden: "Quedan", quedaPartit: "queda 1 partido", quedenPartits: "quedan {n} partidos",
  sancio: "Sanción", motiu: "Motivo", sancionatsVigents: "Sancionados vigentes", historialSancions: "Historial de sanciones",
  falta_joc: "Falta de juego", joc_violent: "Juego violento", antiesportiva: "Conducta antideportiva", agressio: "Agresión / pelea", acumulacio: "Acumulación de amarillas", comite: "Decisión del comité",
  camp: "Campo", hora: "Hora", horaPerConfirmar: "hora por confirmar", arbitre: "Árbitro", observacions: "Observaciones",
  acta: "Acta", veureActa: "Ver acta", ajornat: "Aplazado", noPresentat: "No presentado",
  titulars: "Titulares", suplents: "Suplentes", delegats: "Delegados y técnicos",
  delegat: "Delegado", entrenador: "Entrenador", "delegat-entrenador": "Delegado y entrenador",
  colors: "Colores", poblacio: "Población", aLaLligaDes: "En la liga desde", informacio: "Información",
  comunicats: "Comunicados de la liga", totsElsComunicats: "Todos los comunicados", llegirMes: "Leer más",
  capJornadaJugada: "Todavía no se ha jugado ninguna jornada", capResultat: "Sin resultados",
  calNote: "Los partidos jugados muestran el resultado; haz clic en un partido para ver el acta.",
  resNote: "Por defecto se muestra la última jornada jugada.",
  anterior: "Anterior", seguent: "Siguiente",
  tornaEquip: "Volver al equipo", tornaLliga: "Volver a la clasificación",
  penal: "penalti", pen: "pen.", segonaGroga: "2ª amarilla", vermellaDirecta: "roja directa",
  documents: "Documentos", descarregar: "Descargar", senseContingut: "Contenido pendiente de publicar.",
  peu: "Amics del futbol amateur · Campionats per a veterans",
  admin: "Administración", entrar: "Entrar", sortir: "Salir",
  golejadorsSub: "Ranking por grupo", sancionsSub: "Tarjetas y sancionados vigentes", calendariSub: "Horarios y campos por jornada", reglamentSub: "Normativa de la liga",
  forma: "Forma",
  cap: "Ninguno", jugadorsSancionats: "jugadores sancionados", capSancionat: "Ningún jugador sancionado actualmente.",
  fitxaDes: "Ficha desde", baixa: "Baja",
  arxiu: "Archivo", actual: "Actual", veureTemporada: "Ver temporada", arxiuBanner: "Estás consultando el archivo de la temporada", tornaActual: "Volver a la temporada actual", temporades: "Temporadas",
  cartes: "Cartas", taula: "Tabla", tancar: "Cerrar",
  records: "Récords", totsElsTemps: "Todos los tiempos", campions: "Campeones", enCurs: "en curso",
  recTopScorer: "Máximos goleadores", recHatTricks: "Hat-tricks (3+ goles en un partido)", recBestGk: "Mejor portero (goles encajados por partido)", recCleanSheets: "Porterías a cero",
  recBiggestWin: "Victoria más amplia", recMostGoalsMatch: "Partido con más goles", recUnbeaten: "Racha más larga sin perder", recWinStreak: "Racha más larga de victorias",
  recAttack: "Mejor ataque (goles a favor)", recDefense: "Mejor defensa (goles encajados por partido)", recMostApps: "Más partidos jugados", recCards: "Más tarjetas",
  porteriaZero: "porterías a cero", min3: "Se necesita un mínimo de 3 partidos.",
  forma5: "Forma", ratxa: "Racha actual", ratxaW: "victorias seguidas", ratxaU: "partidos sin perder", ratxaL: "derrotas seguidas", casa: "Casa", fora: "Fuera", millorVictoria: "Mejor victoria", pitjorDerrota: "Peor derrota", golsPerPartit: "Goles por partido",
  h2h: "Cara a cara", enfrontaments: "enfrentamientos", victories: "victorias", empats: "empates", historial: "Historial",
  subscriuCalendari: "Añadir al calendario del móvil", descarregarIcs: "Descargar .ics", imprimirPdf: "Imprimir / guardar como PDF", pdf: "PDF",
  galeria: "Galería de fotos", cerca: "Buscar jugador", cercaPh: "Apellido o nombre…", resultatsCerca: "Resultados de la búsqueda", capResultatCerca: "Ningún jugador encontrado.",
  avisGrogues: "A una amarilla de la sanción", proximPartit: "Próximo partido",
  desenvolupatPer: "Desarrollado por",
  valoracio: "Valoración", valoraArbitre: "Valora el arbitraje de este partido (1 = muy mal · 5 = excelente)", actualitzar: "Actualizar", presentarProtesta: "Presentar una protesta", protestaCheck: "Presento una protesta formal sobre el arbitraje", protestaPh: "Motivo de la protesta (solo lo ve el comité de árbitros)", protestaPresentada: "Protesta presentada",
  reportError: "¿Hay un error en el acta?", reportPh: "Explica qué no es correcto (resultado, gol, tarjeta…)", reportContact: "Nombre / teléfono (opcional)", enviar: "Enviar", modeFosc: "Modo oscuro",
  pushOn: "Notificaciones activadas", pushOff: "Avísame de los partidos", pushOffGroup: "Avísame de los resultados del Grupo", pushUnsupported: "El navegador no admite notificaciones (en iPhone hay que añadir la web a la pantalla de inicio)", pushHint: "Recibe los resultados y los cambios de horario en el móvil:",
  partitsEndarrerits: "Partidos atrasados y aplazados", dataPerConfirmar: "fecha por confirmar", aniversaris: "Cumpleaños de la semana", avui: "hoy", ahir: "ayer", dema: "mañana",
};

export const dict: Record<Lang, typeof ca> = { ca, es };
export type Dict = typeof ca;

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return c === "es" ? "es" : "ca";
}
/** Public pages call this first: it also reads the archive-season cookie so every query below uses the season the visitor chose. */
export async function getT() { const l = await getLang(); await readSeasonCookie(); return { lang: l, t: dict[l] }; }

const MONTHS: Record<Lang, string[]> = {
  ca: ["gen", "feb", "març", "abr", "maig", "juny", "jul", "ag", "set", "oct", "nov", "des"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};
export function fmtDate(iso: string | null | undefined, lang: Lang, withYear = true) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[lang][m - 1]}${withYear ? " " + y : ""}`;
}
export function fmtDob(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
export function age(iso: string | null | undefined) {
  if (!iso) return null;
  const b = new Date(iso); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}
