/* Import an archived season (results only) from seed/season-<name>.json built from the league circulars.
   Run inside the container:  node node_modules/tsx/dist/cli.mjs seed/import-season.ts 2025-26
   Creates the season (inactive), groups, teams (logo/photo copied from same-named current teams), rounds and matches. Idempotent by season name. */
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const name = process.argv[2] || "2025-26";
const file = path.join(__dirname, `season-${name}.json`);
type M = { home: string; away: string; date: string | null; hg: number | null; ag: number | null; status: string; notes?: string };
type G = { teams: string[]; rounds: Record<string, { date: string | null; matches: M[] }>; topSlots: number; relegSlots: number; topLabel: string };
const data = JSON.parse(fs.readFileSync(file, "utf8")) as { season: string; note?: string; groups: Record<string, G> };
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const norm = (s: string) => slugify(s).replace(/-/g, " ");

if (db.select().from(schema.seasons).where(eq(schema.seasons.name, data.season)).get()) { console.log(`Season ${data.season} already exists`); process.exit(0); }
const current = db.select().from(schema.teams).all();
const suffix = data.season.replace(/[^0-9a-z]/gi, "").toLowerCase();

db.transaction((tx) => {
  const [s] = tx.insert(schema.seasons).values({ name: data.season, active: false, yellowsForBan: 5, assistsEnabled: false }).returning().all();
  for (const [gName, g] of Object.entries(data.groups)) {
    const [ng] = tx.insert(schema.groups).values({ seasonId: s.id, name: gName, topSlots: g.topSlots, relegSlots: g.relegSlots, topLabel: g.topLabel }).returning().all();
    const ids = new Map<string, number>();
    for (const t of g.teams) {
      const cur = current.find((c) => norm(c.name) === norm(t)) ?? current.find((c) => norm(c.name).includes(norm(t)) || norm(t).includes(norm(c.name)));
      const [nt] = tx.insert(schema.teams).values({ groupId: ng.id, name: t, slug: `${slugify(t)}-${suffix}`, logo: cur?.logo ?? null, photo: null, town: cur?.town ?? null, field: cur?.field ?? null, colors: cur?.colors ?? null }).returning().all();
      ids.set(t, nt.id);
    }
    const now = new Date().toISOString();
    for (const [jn, r] of Object.entries(g.rounds).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const date = r.date ?? r.matches.find((m) => m.date)?.date ?? "2026-06-13";
      const [round] = tx.insert(schema.rounds).values({ groupId: ng.id, number: Number(jn), date }).returning().all();
      for (const m of r.matches) {
        const h = ids.get(m.home), a = ids.get(m.away);
        if (!h || !a) { console.log(`✗ team? ${m.home} / ${m.away}`); continue; }
        tx.insert(schema.matches).values({
          roundId: round.id, homeId: h, awayId: a, date: m.date && m.date !== date ? m.date : null,
          status: m.status as "played" | "walkover" | "postponed" | "scheduled", homeGoals: m.hg, awayGoals: m.ag, published: true, notes: m.notes ?? null, updatedAt: now,
        }).run();
      }
    }
    console.log(`✓ Grup ${gName}: ${g.teams.length} equips, ${Object.keys(g.rounds).length} jornades`);
  }
  if (data.note) tx.insert(schema.settings).values({ key: `season_note_${data.season}`, value: data.note }).onConflictDoUpdate({ target: schema.settings.key, set: { value: data.note } }).run();
});
console.log(`Season ${data.season} imported`);
