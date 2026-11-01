// Missed penalties + fix: Bonmatí's first goal vs Fogars was a penalty. Re-runnable.
import { db, schema } from "../src/db";
import { eq, and, like, asc } from "drizzle-orm";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const teams = db.select().from(schema.teams).all();
const team = (re: RegExp) => teams.find((t) => re.test(t.name))!;
const fog = team(/fogars/i);
const rounds = db.select().from(schema.rounds).where(eq(schema.rounds.groupId, fog.groupId)).all();
const matchVs = (opp: { id: number }) => db.select().from(schema.matches).all().find((m) => rounds.some((r) => r.id === m.roundId) && ((m.homeId === fog.id && m.awayId === opp.id) || (m.awayId === fog.id && m.homeId === opp.id)))!;
const playerOf = (teamId: number, frag: string | null) => {
  const sq = db.select().from(schema.players).where(eq(schema.players.teamId, teamId)).all();
  const p = frag ? sq.find((x) => norm(`${x.name} ${x.surname}`).includes(norm(frag))) : null;
  if (p) return p;
  let ph = sq.find((x) => /^Jugador /.test(x.surname));
  if (!ph) [ph] = db.insert(schema.players).values({ teamId, surname: "Jugador 1", name: "", position: "MIG" }).returning().all();
  return ph;
};
const addMissed = (m: { id: number }, teamId: number, frag: string | null, minute: number) => {
  const p = playerOf(teamId, frag);
  const dup = db.select().from(schema.events).where(and(eq(schema.events.matchId, m.id), eq(schema.events.type, "pen_fallat"), eq(schema.events.minute, minute))).get();
  if (dup) { console.log("already:", m.id, minute); return; }
  db.insert(schema.events).values({ matchId: m.id, playerId: p.id, type: "pen_fallat", minute, sort: 50 + minute }).run();
  console.log("✓ pen fallat", m.id, `${p.name} ${p.surname}`.trim(), minute);
};

// J9 Restaurant Amura 2-6 Fogars: Amura missed a penalty at 14' ("Zizi")
const amu = team(/amura/i);
addMissed(matchVs(amu), amu.id, "zizi", 14);

// J8 Fogars 5-2 Bonmatí: their first goal was a penalty
const bon = team(/bonmat/i);
const mb = matchVs(bon);
const theirs = db.select().from(schema.events).where(eq(schema.events.matchId, mb.id)).orderBy(asc(schema.events.sort), asc(schema.events.id)).all()
  .filter((e) => (e.type === "gol" || e.type === "gol_pen") && db.select().from(schema.players).where(eq(schema.players.id, e.playerId)).get()?.teamId === bon.id)
  .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.sort - b.sort);
if (theirs[0]) { db.update(schema.events).set({ type: "gol_pen" }).where(eq(schema.events.id, theirs[0].id)).run(); console.log("✓ Bonmatí goal", theirs[0].minute ?? "?", "→ gol_pen"); }
else console.log("Bonmatí: no goal events found");

// Maçanet: missed penalty at 65' — set WHO below (team regex + player fragment) and uncomment
// const mac = team(/ma[cç]anet/i); addMissed(matchVs(mac), fog.id, "Zinchenko", 65);
console.log("done");
