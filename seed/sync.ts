/* Sync from the old league site (futbolempresesgirona.com).
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/sync.ts [horaris|resultats|golejadors|all]
   Idempotent: only fills what is missing or changed. Logs what it does. */
import { db, schema } from "../src/db";
import { eq, and, like, desc, inArray } from "drizzle-orm";

const BASE = "https://www.futbolempresesgirona.com/index.php";
const UA = { "User-Agent": "Mozilla/5.0 (lliga.cffogars.com sync)" };
const ALIASES: Record<string, string> = { "fb vilobi": "fvb vilobi", "bar moreda": "restaurant amura", "veterans san andres": "veterans sant andreu", "vet tordera san andres": "veterans sant andreu", "comacros c la h": "coma cros c la h", "angles huellas de colombia": "angles huellas colombia" };
const PAGES: Record<string, string> = { "golejadors-A": "taula-goleador-grup-a", "golejadors-B": "taula-golejadors-grup-b" };
const MONTHS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const decode = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;|&#039;/g, "'").replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
/** Parse every table row into its cell texts */
function rows(html: string): string[][] {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1])));
}
function parseCatDate(s: string): string | null {
  const m = norm(s).match(/(\d{1,2}) (?:de? )?([a-z]+)(?: de)? (\d{4})/);
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => norm(x) === m[2]);
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
async function page(path: string) {
  const r = await fetch(`${BASE}/${path}/`, { headers: UA });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
}

const season = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get()!;
const groups = db.select().from(schema.groups).where(eq(schema.groups.seasonId, season.id)).all();
const teams = db.select().from(schema.teams).all().filter((t) => groups.some((g) => g.id === t.groupId));
/** Dice coefficient on character bigrams (tolerates typos like VETTERANS / VETRANS) */
function sim(a: string, b: string) {
  const bg = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let inter = 0; for (const [k, v] of A) inter += Math.min(v, B.get(k) ?? 0);
  return (2 * inter) / (a.length - 1 + b.length - 1 || 1);
}
const findTeam = (gId: number, name: string) => {
  const n = ALIASES[norm(name)] ?? norm(name);
  if (!n) return undefined;
  const pool = teams.filter((t) => t.groupId === gId);
  const exact = pool.find((t) => norm(t.name) === n) ?? pool.find((t) => norm(t.name).includes(n) || n.includes(norm(t.name)));
  if (exact) return exact;
  const best = pool.map((t) => ({ t, s: sim(norm(t.name), n) })).sort((x, y) => y.s - x.s)[0];
  return best && best.s >= 0.7 ? best.t : undefined;
};
const now = () => new Date().toISOString();
function matchIn(gId: number, round: number, h: number, a: number) {
  const r = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, gId), eq(schema.rounds.number, round))).get();
  if (!r) return null;
  let m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, h), eq(schema.matches.awayId, a))).get();
  if (!m) {
    m = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, r.id), eq(schema.matches.homeId, a), eq(schema.matches.awayId, h))).get();
    if (m) { db.update(schema.matches).set({ homeId: h, awayId: a }).where(eq(schema.matches.id, m.id)).run(); console.log(`  (home/away swapped) J${round}`); }
  }
  return m ?? null;
}

/* ---------- horaris (next round kick-off times) ---------- */
async function syncHoraris() {
  const html = await page("horaris-propera-jornada");
  const rs = rows(html);
  const head = rs.map((r) => r.join(" ")).find((t) => /jornada del dia/i.test(t)) ?? "";
  const date = parseCatDate(head);
  if (!date) { console.log("✗ horaris: no date in", head); return; }
  let g: (typeof groups)[number] | null = null, n = 0;
  for (const r of rs) {
    const gm = r[0]?.match(/^Grup\s+([A-Z])/i);
    if (gm) { g = groups.find((x) => x.name.toUpperCase() === gm[1].toUpperCase()) ?? null; continue; }
    if (!g || r.length < 2 || !/[–—-]/.test(r[0])) continue;
    const [home, away] = r[0].split(/\s[–—-]\s/).map((s) => s.trim());
    if (!home || !away) continue;
    const round = db.select().from(schema.rounds).where(and(eq(schema.rounds.groupId, g.id), eq(schema.rounds.date, date))).get();
    if (!round) { console.log(`✗ no round on ${date} for grup ${g.name}`); return; }
    const h = findTeam(g.id, home), a = findTeam(g.id, away);
    if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); continue; }
    const m = matchIn(g.id, round.number, h.id, a.id);
    if (!m) { console.log(`✗ match not in J${round.number}: ${home} – ${away}`); continue; }
    if (m.status === "played") continue;
    const info = r[1];
    if (/ajornat|aplazado|suspès/i.test(info)) {
      if (m.status !== "postponed") { db.update(schema.matches).set({ status: "postponed", time: null, notes: "Ajornat", updatedAt: now() }).where(eq(schema.matches.id, m.id)).run(); console.log(`✓ J${round.number} ajornat ${h.name} – ${a.name}`); n++; }
      continue;
    }
    const tm = info.match(/(\d{1,2}[:.]\d{2})/); const time = tm ? tm[1].replace(".", ":").padStart(5, "0") : null;
    const field = info.replace(/^[^–—-]*[–—-]\s*/, "").trim() || null;
    if (time && (m.time !== time || (field && m.field !== field) || m.status === "postponed")) {
      db.update(schema.matches).set({ time, ...(field ? { field } : {}), status: "scheduled", updatedAt: now() }).where(eq(schema.matches.id, m.id)).run();
      console.log(`✓ J${round.number} ${h.name} – ${a.name} · ${time} ${field ?? ""}`); n++;
    }
  }
  console.log(`horaris ${date}: ${n} canvis`);
}

/* ---------- resultats ---------- */
async function syncResultats() {
  let n = 0;
  for (const g of groups) {
    const html = await page(`resultats-grup-${g.name.toLowerCase()}`);
    let round = 0;
    for (const r of rows(html)) {
      const jm = r.join(" ").match(/(\d{1,2})a?\.?\s*JORNADA/i);
      if (jm) { round = Number(jm[1]); continue; }
      if (!round || r.length < 3) continue;
      const [home, score, away] = [r[0], r[1], r[2]];
      if (!home.trim() || !away.trim()) continue;
      if (!/\d\s*[–—-]\s*\d|ajor|susp/i.test(score)) continue; // nothing published yet
      const h = findTeam(g.id, home), a = findTeam(g.id, away);
      if (!h || !a) { console.log(`✗ team not found: ${!h ? home : away}`); continue; }
      const m = matchIn(g.id, round, h.id, a.id);
      if (!m) { console.log(`✗ match not in J${round}: ${home} – ${away}`); continue; }
      const sm = score.match(/(\d+)\s*[–—-]\s*(\d+)/);
      if (sm) {
        const hg = Number(sm[1]), ag = Number(sm[2]);
        if (m.status !== "played" || m.homeGoals !== hg || m.awayGoals !== ag) {
          db.update(schema.matches).set({ status: "played", homeGoals: hg, awayGoals: ag, published: true, updatedAt: now() }).where(eq(schema.matches.id, m.id)).run();
          console.log(`✓ J${round} ${h.name} ${hg}-${ag} ${a.name}`); n++;
        }
      } else if (/ajor|susp/i.test(score) && m.status === "scheduled") {
        db.update(schema.matches).set({ status: "postponed", time: null, notes: "Ajornat", updatedAt: now() }).where(eq(schema.matches.id, m.id)).run();
        console.log(`✓ J${round} ajornat ${h.name} – ${a.name}`); n++;
      }
    }
  }
  console.log(`resultats: ${n} canvis`);
}

/* ---------- golejadors ---------- */
function splitName(full: string): [string, string] {
  const p = full.trim().split(/\s+/).map((w) => w.length > 2 || /\./.test(w) ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase());
  // 2 → given + surname; 3 → given + 2 surnames; 4+ → 2 given + rest
  if (p.length <= 2) return [p[0] ?? "", p.slice(1).join(" ")];
  if (p.length === 3) return [p[0], p.slice(1).join(" ")];
  return [p.slice(0, 2).join(" "), p.slice(2).join(" ")];
}
function findPlayer(teamId: number, full: string) {
  const squad = db.select().from(schema.players).where(eq(schema.players.teamId, teamId)).all();
  const f = norm(full);
  const exact = squad.find((x) => norm(`${x.name} ${x.surname}`) === f || norm(`${x.surname} ${x.name}`) === f)
    ?? squad.find((x) => { const s = norm(x.surname); return s && f.endsWith(s) && norm(x.name).split(" ")[0] === f.split(" ")[0]; })
    ?? squad.find((x) => { const s = norm(x.surname); return s && s.split(" ").length >= 2 && f.endsWith(s); });
  if (exact) return exact;
  // typo-tolerant: best bigram similarity of "given surname" / "surname given"
  const best = squad.filter((x) => !/^Jugador /.test(x.surname)).map((x) => ({ x, s: Math.max(sim(norm(`${x.name} ${x.surname}`), f), sim(norm(`${x.surname} ${x.name}`), f)) })).sort((a, b) => b.s - a.s)[0];
  return best && best.s >= 0.72 ? best.x : undefined;
}
function addPlayer(teamId: number, full: string) {
  const [given, surname] = splitName(full);
  const ph = db.select().from(schema.players).where(and(eq(schema.players.teamId, teamId), like(schema.players.surname, "Jugador %"))).orderBy(desc(schema.players.id)).get();
  if (ph) { db.update(schema.players).set({ surname, name: given, dorsal: null }).where(eq(schema.players.id, ph.id)).run(); return { ...ph, surname, name: given }; }
  const [np] = db.insert(schema.players).values({ teamId, surname, name: given, position: "MIG", registeredAt: new Date().toISOString().slice(0, 10) }).returning().all();
  return np;
}
const MAX_ROUND = Number(process.env.MAX_ROUND ?? 99);
async function syncGolejadors() {
  let added = 0, goals = 0, pending = 0;
  for (const g of groups) {
    const html = await page(PAGES[`golejadors-${g.name.toUpperCase()}`] ?? `taula-golejadors-grup-${g.name.toLowerCase()}`);
    const rounds = db.select().from(schema.rounds).where(eq(schema.rounds.groupId, g.id)).all();
    const rid = new Map(rounds.map((r) => [r.id, r]));
    let team: (typeof teams)[number] | null = null;
    for (const r of rows(html)) {
      if (r.length === 1 && r[0] && !/gols?$/i.test(r[0]) && !/TAULA DE GOLEJADORS/i.test(r[0])) { team = findTeam(g.id, r[0]) ?? null; if (!team) console.log(`✗ team not found: ${r[0]}`); continue; }
      if (!team || r.length < 2) continue;
      const gm = r[1].match(/(\d+)\s*gol/i); if (!gm) continue;
      const target = Number(gm[1]); const full = r[0];
      let p = findPlayer(team.id, full);
      if (!p) { p = addPlayer(team.id, full); added++; console.log(`  + ${p.surname}, ${p.name} (${team.name})`); }
      // played matches of this team, newest first
      const ms = db.select().from(schema.matches).where(and(inArray(schema.matches.roundId, rounds.map((x) => x.id)), eq(schema.matches.status, "played"))).all()
        .filter((m) => m.homeId === team!.id || m.awayId === team!.id)
        .filter((m) => rid.get(m.roundId)!.number <= MAX_ROUND) // MAX_ROUND=9 → never attribute to rounds after 9
        .sort((x, y) => (y.date ?? rid.get(y.roundId)!.date).localeCompare(x.date ?? rid.get(x.roundId)!.date));
      const mids = ms.map((m) => m.id);
      const evs = mids.length ? db.select().from(schema.events).where(inArray(schema.events.matchId, mids)).all().filter((e) => e.type === "gol" || e.type === "gol_pen") : [];
      const have = evs.filter((e) => e.playerId === p!.id).length;
      let delta = target - have;
      if (delta <= 0) continue;
      const squadIds = new Set(db.select({ id: schema.players.id }).from(schema.players).where(eq(schema.players.teamId, team.id)).all().map((x) => x.id));
      for (const m of ms) {
        if (delta <= 0) break;
        const scored = m.homeId === team.id ? m.homeGoals ?? 0 : m.awayGoals ?? 0;
        const attributed = evs.filter((e) => e.matchId === m.id && squadIds.has(e.playerId)).length;
        let cap = scored - attributed;
        while (cap > 0 && delta > 0) {
          db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type: "gol", minute: null, sort: 100 + attributed + cap }).run();
          evs.push({ matchId: m.id, playerId: p.id, type: "gol" } as (typeof evs)[number]);
          cap--; delta--; goals++;
        }
      }
      if (delta > 0) { pending++; console.log(`? ${p.surname}, ${p.name} (${team.name}): ${delta} gol(s) sense partit on posar-los`); }
    }
  }
  console.log(`golejadors: ${added} jugadors nous, ${goals} gols afegits, ${pending} pendents`);
}

const what = process.argv[2] ?? "all";
(async () => {
  if (what === "horaris" || what === "all") await syncHoraris();
  if (what === "resultats" || what === "all") await syncResultats();
  if (what === "golejadors" || what === "all") await syncGolejadors();
})().catch((e) => { console.error("✗", e.message); process.exit(1); });
