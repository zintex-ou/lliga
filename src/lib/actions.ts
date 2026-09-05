"use server";
import { db, schema, UPLOAD_DIR } from "@/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { login, logout, requireUser, audit, canEditMatches, isAdmin, type Role } from "@/lib/auth";
import { teamKey } from "@/lib/stats";
import { notifyMatch, notifyAll } from "@/lib/push";

const str = (fd: FormData, k: string) => (fd.get(k) as string | null)?.toString().trim() ?? "";
const num = (fd: FormData, k: string) => { const v = str(fd, k); return v === "" ? null : Number(v); };
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1" || fd.get(k) === "true";

function revalidateAll() { revalidatePath("/", "layout"); }

/* ---------- auth ---------- */
export async function loginAction(_prev: { error?: string } | null, fd: FormData) {
  const ok = await login(str(fd, "email"), str(fd, "password"));
  if (!ok) return { error: "Correu o contrasenya incorrectes" };
  redirect("/admin");
}
export async function logoutAction() { await logout(); redirect("/"); }

/* ---------- uploads ---------- */
type Kind = "logo" | "photo" | "player" | "file";
async function saveUpload(file: File | null, kind: Kind, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(UPLOAD_DIR, kind === "file" ? "docs" : kind);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = Date.now().toString(36);
  if (kind === "file") {
    const ext = path.extname(file.name).toLowerCase() || ".pdf";
    const name = `${prefix}-${stamp}${ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return `docs/${name}`;
  }
  const name = `${prefix}-${stamp}.jpg`;
  let img = sharp(buf).rotate();
  if (kind === "logo") img = img.resize(400, 400, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } });
  else if (kind === "photo") img = img.resize(1200, 800, { fit: "cover", position: "attention" });
  else img = img.resize(600, 800, { fit: "cover", position: "attention" });
  await img.jpeg({ quality: 86 }).toFile(path.join(dir, name));
  return `${kind}/${name}`;
}

/* ---------- teams ---------- */
async function teamAccess(teamId: number) {
  const u = await requireUser();
  if (canEditMatches(u.role)) return { u, full: true };
  if (u.role === "delegat" && u.teamId === teamId) return { u, full: false };
  redirect("/admin");
}

export async function saveTeam(fd: FormData) {
  const id = Number(fd.get("id"));
  const { u, full } = await teamAccess(id);
  const logo = await saveUpload(fd.get("logo") as File | null, "logo", `t${id}`);
  const photo = await saveUpload(fd.get("photo") as File | null, "photo", `t${id}`);
  const patch: Partial<typeof schema.teams.$inferInsert> = {};
  if (logo) patch.logo = logo;
  if (photo) patch.photo = photo;
  if (fd.has("colors")) patch.colors = str(fd, "colors") || null; // delegates may edit the kit description
  if (full) {
    Object.assign(patch, { name: str(fd, "name") || undefined, short: str(fd, "short") || null, field: str(fd, "field") || null, town: str(fd, "town") || null, founded: str(fd, "founded") || null, info: str(fd, "info") || null });
  }
  db.update(schema.teams).set(patch).where(eq(schema.teams.id, id)).run();
  audit(u.id, "team", id, "update");
  revalidateAll();
}

export async function saveStaff(fd: FormData) {
  const teamId = Number(fd.get("teamId"));
  const { u } = await teamAccess(teamId);
  const id = num(fd, "id");
  const row = { teamId, name: str(fd, "name"), role: str(fd, "role") || "delegat", phone: str(fd, "phone") || null, email: str(fd, "email") || null, phoneVisible: true, sort: num(fd, "sort") ?? 0 };
  if (!row.name) return;
  if (id) db.update(schema.staff).set(row).where(and(eq(schema.staff.id, id), eq(schema.staff.teamId, teamId))).run();
  else db.insert(schema.staff).values(row).run();
  audit(u.id, "staff", id, id ? "update" : "create");
  revalidateAll();
}
export async function deleteStaff(fd: FormData) {
  const teamId = Number(fd.get("teamId")); const id = Number(fd.get("id"));
  const { u } = await teamAccess(teamId);
  db.delete(schema.staff).where(and(eq(schema.staff.id, id), eq(schema.staff.teamId, teamId))).run();
  audit(u.id, "staff", id, "delete"); revalidateAll();
}

/* ---------- players ---------- */
export async function savePlayer(fd: FormData) {
  const teamId = Number(fd.get("teamId"));
  const { u } = await teamAccess(teamId); // admins/presidents and the team's own delegate
  const id = num(fd, "id");
  const photo = await saveUpload(fd.get("photo") as File | null, "player", `p${id ?? "new"}`);
  const row = { teamId, surname: str(fd, "surname"), name: str(fd, "name"), dob: str(fd, "dob") || null, position: str(fd, "position") || "MIG", dorsal: num(fd, "dorsal"), registeredAt: str(fd, "registeredAt") || new Date().toISOString().slice(0, 10), active: fd.has("active") ? bool(fd, "active") : true, ...(photo ? { photo } : {}) };
  if (!row.surname) return;
  if (id) db.update(schema.players).set(row).where(and(eq(schema.players.id, id), eq(schema.players.teamId, teamId))).run();
  else db.insert(schema.players).values(row).run();
  audit(u.id, "player", id, id ? "update" : "create");
  revalidateAll();
}
export async function deletePlayer(fd: FormData) {
  const id = Number(fd.get("id"));
  const pl = db.select().from(schema.players).where(eq(schema.players.id, id)).get();
  if (!pl) return;
  const { u } = await teamAccess(pl.teamId);
  if (db.select().from(schema.appearances).where(eq(schema.appearances.playerId, id)).get()) return; // played: deactivate instead
  db.delete(schema.players).where(eq(schema.players.id, id)).run();
  audit(u.id, "player", id, "delete"); revalidateAll();
}
/** Bulk import: one player per line "Cognoms, Nom, dd.mm.aaaa, POS, dorsal" (comma or tab separated). */
export async function importPlayers(fd: FormData) {
  const teamId = Number(fd.get("teamId"));
  const { u } = await teamAccess(teamId);
  const lines = str(fd, "text").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const POS: Record<string, string> = { POR: "POR", PORTERO: "POR", PORTER: "POR", DEF: "DEF", DEFENSA: "DEF", MIG: "MIG", MED: "MIG", CENTROCAMPISTA: "MIG", MIGCAMPISTA: "MIG", DAV: "DAV", DEL: "DAV", DELANTERO: "DAV", DAVANTER: "DAV" };
  let n = 0;
  for (const l of lines) {
    const parts = l.split(/\t|;|,/).map((x) => x.trim());
    if (parts.length < 1 || !parts[0]) continue;
    let dob: string | null = null;
    const dm = (parts[2] || "").match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (dm) dob = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(parts[2] || "")) dob = parts[2];
    db.insert(schema.players).values({ teamId, surname: parts[0], name: parts[1] || "", dob, position: POS[(parts[3] || "").toUpperCase()] || "MIG", dorsal: parts[4] ? Number(parts[4]) || null : null, registeredAt: new Date().toISOString().slice(0, 10) }).run();
    n++;
  }
  audit(u.id, "team", teamId, `import ${n} players`);
  revalidateAll();
}

/* ---------- schedule ---------- */
export async function saveSchedule(fd: FormData) {
  const u = await requireUser("content");
  const ids = fd.getAll("matchId").map(Number);
  for (const id of ids) {
    const before = db.select().from(schema.matches).where(eq(schema.matches.id, id)).get();
    const nd = str(fd, `date_${id}`) || null, nt = str(fd, `time_${id}`) || null, nf = str(fd, `field_${id}`) || null;
    const changed = before && before.status !== "played" && ((before.time && before.time !== nt) || (before.date && before.date !== nd) || (before.field && before.field !== nf));
    if (changed) void notifySchedule(id, nd, nt, nf);
    db.update(schema.matches).set({
      date: str(fd, `date_${id}`) || null, time: str(fd, `time_${id}`) || null, field: str(fd, `field_${id}`) || null,
      status: (["scheduled", "postponed"].includes(str(fd, `status_${id}`)) ? str(fd, `status_${id}`) : undefined) as "scheduled" | undefined,
      ...(fd.has(`ref_${id}`) ? { refereeId: num(fd, `ref_${id}`) } : {}),
    }).where(eq(schema.matches.id, id)).run();
  }
  audit(u.id, "round", null, `schedule ${ids.length}`);
  revalidateAll();
}

/* ---------- acta ---------- */
export type ActaPayload = {
  matchId: number; status: "played" | "scheduled" | "postponed" | "walkover";
  homeGoals: number | null; awayGoals: number | null; date: string | null; time: string | null; field: string | null; referee: string | null; refereeId?: number | null; notes: string | null;
  publish?: boolean;
  apps: { playerId: number; role: "titular" | "suplent"; entered: boolean; conceded: number | null }[];
  events: { playerId: number; type: string; minute: number | null; assistId: number | null; sanctionMatches?: number | null; sanctionReason?: string | null }[];
};
export async function saveActa(p: ActaPayload) {
  const u = await requireUser("content");
  const m = db.select().from(schema.matches).where(eq(schema.matches.id, p.matchId)).get();
  if (!m) return { error: "Partit no trobat" };
  db.transaction((tx) => {
    tx.update(schema.matches).set({
      status: p.status, homeGoals: p.status === "played" || p.status === "walkover" ? p.homeGoals : null, awayGoals: p.status === "played" || p.status === "walkover" ? p.awayGoals : null,
      date: p.date || null, time: p.time || null, field: p.field || null, referee: p.referee || null, refereeId: p.refereeId ?? null, notes: p.notes || null,
      published: p.publish !== false,
      updatedBy: u.id, updatedAt: new Date().toISOString(),
    }).where(eq(schema.matches.id, p.matchId)).run();
    // sanctions tied to events of this match get replaced
    const oldEvents = tx.select().from(schema.events).where(eq(schema.events.matchId, p.matchId)).all();
    for (const e of oldEvents) tx.delete(schema.sanctions).where(eq(schema.sanctions.eventId, e.id)).run();
    tx.delete(schema.events).where(eq(schema.events.matchId, p.matchId)).run();
    tx.delete(schema.appearances).where(eq(schema.appearances.matchId, p.matchId)).run();
    if (p.status === "played") {
      // goalkeeper conceded: if exactly one GK entered per team and no value given, use the opponent's goals
      const pl = new Map(tx.select().from(schema.players).all().map((x) => [x.id, x]));
      for (const teamId of [m.homeId, m.awayId]) {
        const gks = p.apps.filter((a) => a.entered && pl.get(a.playerId)?.position === "POR" && pl.get(a.playerId)?.teamId === teamId);
        if (gks.length === 1 && gks[0].conceded == null) gks[0].conceded = teamId === m.homeId ? p.awayGoals : p.homeGoals;
      }
      const seen = new Set<number>();
      for (const a of p.apps) {
        if (seen.has(a.playerId)) continue; seen.add(a.playerId);
        tx.insert(schema.appearances).values({ matchId: p.matchId, playerId: a.playerId, role: a.role, entered: a.entered, conceded: a.conceded }).run();
      }
      p.events.filter((e) => e.playerId > 0).forEach((e, i) => {
        const [ev] = tx.insert(schema.events).values({ matchId: p.matchId, playerId: e.playerId, type: e.type, minute: e.minute, assistId: e.assistId, sort: i }).returning().all();
        if (e.type === "vermella" || e.type === "segona_groga") {
          tx.insert(schema.sanctions).values({
            playerId: e.playerId, eventId: ev.id, matchId: p.matchId, matches: Math.max(0, e.sanctionMatches ?? 1),
            reason: e.type === "segona_groga" ? (e.sanctionReason || "antiesportiva") : (e.sanctionReason || "falta_joc"), createdAt: new Date().toISOString(),
          }).run();
        }
      });
    }
  });
  audit(u.id, "match", p.matchId, `acta ${p.status}`);
  revalidateAll();
  const nowPublished = p.publish !== false && (p.status === "played" || p.status === "walkover");
  if (nowPublished && p.homeGoals != null && p.awayGoals != null && (!m.published || m.status !== p.status || m.homeGoals !== p.homeGoals || m.awayGoals !== p.awayGoals)) void notifyResult(p.matchId);
  return { ok: true };
}

/* ---------- sanctions (manual) ---------- */
export async function saveSanction(fd: FormData) {
  const u = await requireUser("content");
  const id = num(fd, "id");
  const row = { playerId: Number(fd.get("playerId")), roundNumber: num(fd, "roundNumber"), matches: num(fd, "matches") ?? 1, reason: str(fd, "reason") || "comite", notes: str(fd, "notes") || null, servedOverride: num(fd, "servedOverride"), createdAt: new Date().toISOString() };
  if (id) db.update(schema.sanctions).set({ matches: row.matches, reason: row.reason, notes: row.notes, servedOverride: row.servedOverride, roundNumber: row.roundNumber ?? undefined }).where(eq(schema.sanctions.id, id)).run();
  else db.insert(schema.sanctions).values(row).run();
  audit(u.id, "sanction", id, id ? "update" : "create"); revalidateAll();
}
export async function deleteSanction(fd: FormData) {
  const u = await requireUser("content"); const id = Number(fd.get("id"));
  db.delete(schema.sanctions).where(eq(schema.sanctions.id, id)).run();
  audit(u.id, "sanction", id, "delete"); revalidateAll();
}

/* ---------- posts / documents / pages ---------- */
export async function savePost(fd: FormData) {
  const u = await requireUser("content"); const id = num(fd, "id");
  const row = { title: str(fd, "title"), body: str(fd, "body"), kind: str(fd, "kind") || "noticia", publishedAt: str(fd, "publishedAt") || new Date().toISOString().slice(0, 10), published: bool(fd, "published") };
  if (!row.title) return;
  if (id) db.update(schema.posts).set(row).where(eq(schema.posts.id, id)).run(); else db.insert(schema.posts).values(row).run();
  audit(u.id, "post", id, id ? "update" : "create"); revalidateAll();
  if (bool(fd, "push") && row.published) void notifyAll({ title: row.title, body: row.body.slice(0, 160), url: "/normatives/circulars", tag: `post-${id ?? Date.now()}` });
}
export async function deletePost(fd: FormData) {
  const u = await requireUser("content"); const id = Number(fd.get("id"));
  db.delete(schema.posts).where(eq(schema.posts.id, id)).run(); audit(u.id, "post", id, "delete"); revalidateAll();
}
export async function saveDocument(fd: FormData) {
  const u = await requireUser("content"); const id = num(fd, "id");
  const file = await saveUpload(fd.get("file") as File | null, "file", "doc");
  const row = { title: str(fd, "title"), category: str(fd, "category") || "documentacio", body: str(fd, "body") || null, sort: num(fd, "sort") ?? 0, ...(file ? { file } : {}) };
  if (!row.title) return;
  if (id) db.update(schema.documents).set(row).where(eq(schema.documents.id, id)).run(); else db.insert(schema.documents).values(row).run();
  audit(u.id, "document", id, id ? "update" : "create"); revalidateAll();
}
export async function deleteDocument(fd: FormData) {
  const u = await requireUser("content"); const id = Number(fd.get("id"));
  db.delete(schema.documents).where(eq(schema.documents.id, id)).run(); audit(u.id, "document", id, "delete"); revalidateAll();
}
export async function savePage(fd: FormData) {
  const u = await requireUser("content"); const slug = str(fd, "slug");
  db.update(schema.pages).set({ title: str(fd, "title"), body: str(fd, "body") }).where(eq(schema.pages.slug, slug)).run();
  audit(u.id, "page", null, slug); revalidateAll();
}

/* ---------- users ---------- */
export async function saveUser(fd: FormData) {
  const u = await requireUser("admin"); const id = num(fd, "id");
  const role = str(fd, "role") as Role; const pw = str(fd, "password");
  const row = { email: str(fd, "email").toLowerCase(), name: str(fd, "name"), role, teamId: role === "delegat" ? num(fd, "teamId") : null, refereeId: role === "arbitre" ? num(fd, "refereeId") : null, active: bool(fd, "active") };
  if (!row.email || !row.name) return;
  if (id) db.update(schema.users).set({ ...row, ...(pw ? { passwordHash: bcrypt.hashSync(pw, 10) } : {}) }).where(eq(schema.users.id, id)).run();
  else { if (!pw) return; db.insert(schema.users).values({ ...row, passwordHash: bcrypt.hashSync(pw, 10), createdAt: new Date().toISOString() }).run(); }
  audit(u.id, "user", id, id ? "update" : "create"); revalidateAll();
}
export async function deleteUser(fd: FormData) {
  const u = await requireUser("admin"); const id = Number(fd.get("id"));
  if (id === u.id) return;
  db.delete(schema.users).where(eq(schema.users.id, id)).run(); audit(u.id, "user", id, "delete"); revalidateAll();
}
export async function changeOwnPassword(fd: FormData) {
  const u = await requireUser(); const pw = str(fd, "password");
  if (pw.length < 8) return;
  db.update(schema.users).set({ passwordHash: bcrypt.hashSync(pw, 10) }).where(eq(schema.users.id, u.id)).run();
}

/* ---------- settings ---------- */
export async function saveSettings(fd: FormData) {
  const u = await requireUser("admin");
  const seasonId = Number(fd.get("seasonId"));
  db.update(schema.seasons).set({ name: str(fd, "name"), yellowsForBan: num(fd, "yellowsForBan") ?? 5, assistsEnabled: bool(fd, "assistsEnabled") }).where(eq(schema.seasons.id, seasonId)).run();
  for (const gid of fd.getAll("groupId").map(Number)) {
    db.update(schema.groups).set({ topSlots: num(fd, `top_${gid}`) ?? 1, relegSlots: num(fd, `releg_${gid}`) ?? 1, topLabel: str(fd, `label_${gid}`) || "campio" }).where(eq(schema.groups.id, gid)).run();
  }
  const logo = fd.get("logo") as File | null;
  if (logo && logo.size > 0) {
    const buf = Buffer.from(await logo.arrayBuffer());
    fs.mkdirSync(path.join(UPLOAD_DIR, "site"), { recursive: true });
    const ext = logo.type === "image/png" || logo.type === "image/svg+xml" ? (logo.type === "image/png" ? ".png" : ".svg") : ".png";
    const name = `site/logo-${Date.now().toString(36)}${ext}`;
    if (ext === ".svg") fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    else await sharp(buf).resize(512, 512, { fit: "inside", withoutEnlargement: true }).png().toFile(path.join(UPLOAD_DIR, name));
    db.insert(schema.settings).values({ key: "logo", value: name }).onConflictDoUpdate({ target: schema.settings.key, set: { value: name } }).run();
  }
  audit(u.id, "season", seasonId, "settings"); revalidateAll();
  void isAdmin;
}

/* ---------- seasons (archive) ---------- */
const CA_MONTHS: Record<string, number> = { gener: 1, febrer: 2, "març": 3, marc: 3, abril: 4, maig: 5, juny: 6, juliol: 7, agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12 };
function parseCaDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+(?:de\s+|d')?([a-zç]+)\s+(?:de\s+)?(\d{4})/i);
  if (m) { const mo = CA_MONTHS[m[2].toLowerCase()]; if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso[0];
  const eu = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/); if (eu) return `${eu[3]}-${eu[2].padStart(2, "0")}-${eu[1].padStart(2, "0")}`;
  return null;
}

/** Create a new season: copies groups, teams (with logos/photos/info/staff) and active players; the old season stays as archive. */
export async function createSeason(fd: FormData) {
  const u = await requireUser("admin");
  const name = str(fd, "name"); if (!name) return;
  const copyTeams = bool(fd, "copyTeams");
  const old = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get();
  db.transaction((tx) => {
    tx.update(schema.seasons).set({ active: false }).run();
    const [s] = tx.insert(schema.seasons).values({ name, active: true, yellowsForBan: old?.yellowsForBan ?? 5, assistsEnabled: old?.assistsEnabled ?? true }).returning().all();
    const oldGroups = old ? tx.select().from(schema.groups).where(eq(schema.groups.seasonId, old.id)).all() : [];
    for (const g of oldGroups.length ? oldGroups : [{ name: "A", topSlots: 1, relegSlots: 2, topLabel: "campio" }, { name: "B", topSlots: 2, relegSlots: 1, topLabel: "ascens" }]) {
      const [ng] = tx.insert(schema.groups).values({ seasonId: s.id, name: g.name, topSlots: g.topSlots, relegSlots: g.relegSlots, topLabel: g.topLabel }).returning().all();
      if (!copyTeams || !("id" in g)) continue;
      for (const t of tx.select().from(schema.teams).where(eq(schema.teams.groupId, g.id)).all()) {
        const [nt] = tx.insert(schema.teams).values({ groupId: ng.id, name: t.name, slug: `${t.slug}-${name.replace(/[^0-9a-z]/gi, "").toLowerCase()}`, short: t.short, logo: t.logo, photo: t.photo, colors: t.colors, field: t.field, town: t.town, founded: t.founded, info: t.info }).returning().all();
        for (const st of tx.select().from(schema.staff).where(eq(schema.staff.teamId, t.id)).all()) tx.insert(schema.staff).values({ teamId: nt.id, name: st.name, role: st.role, phone: st.phone, phoneVisible: st.phoneVisible, sort: st.sort }).run();
        for (const p of tx.select().from(schema.players).where(and(eq(schema.players.teamId, t.id), eq(schema.players.active, true))).all()) tx.insert(schema.players).values({ teamId: nt.id, surname: p.surname, name: p.name, dob: p.dob, position: p.position, dorsal: p.dorsal, photo: p.photo, registeredAt: new Date().toISOString().slice(0, 10) }).run();
      }
    }
  });
  audit(u.id, "season", null, `create ${name}`); revalidateAll();
}

/** Import a calendar for a group of the active season from text: "JORNADA 3 - 19 setembre 2026" then lines "Equip local - Equip visitant". */
export async function importCalendar(fd: FormData) {
  const u = await requireUser("admin");
  const groupId = Number(fd.get("groupId"));
  const teams = db.select().from(schema.teams).where(eq(schema.teams.groupId, groupId)).all();
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const byName = new Map(teams.map((t) => [norm(t.name), t.id]));
  const findTeam = (n: string) => byName.get(norm(n)) ?? teams.find((t) => norm(t.name).includes(norm(n)) || norm(n).includes(norm(t.name)))?.id;
  const existing = db.select().from(schema.rounds).where(eq(schema.rounds.groupId, groupId)).all();
  let round: typeof existing[number] | null = null; let n = 0; const errors: string[] = [];
  for (const raw of str(fd, "text").split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const jm = line.match(/^jornada\s+(\d+)\s*[-–:]?\s*(.*)$/i);
    if (jm) {
      const number = Number(jm[1]); const date = parseCaDate(jm[2]) ?? new Date().toISOString().slice(0, 10);
      const alt = jm[2].match(/\(([^)]+)\)/); const altDate = alt ? parseCaDate(alt[1]) : null;
      const ex = existing.find((r) => r.number === number);
      if (ex) { db.update(schema.rounds).set({ date, altDate }).where(eq(schema.rounds.id, ex.id)).run(); round = { ...ex, date, altDate }; }
      else { round = db.insert(schema.rounds).values({ groupId, number, date, altDate }).returning().get(); existing.push(round); }
      continue;
    }
    const mm = line.replace(/^\d+[.)]\s*/, "").split(/\s+[-–]\s+/);
    if (mm.length !== 2 || !round) continue;
    const h = findTeam(mm[0]), a = findTeam(mm[1]);
    if (!h || !a) { errors.push(line); continue; }
    const dup = db.select().from(schema.matches).where(and(eq(schema.matches.roundId, round.id), eq(schema.matches.homeId, h))).get();
    if (dup) continue;
    db.insert(schema.matches).values({ roundId: round.id, homeId: h, awayId: a }).run(); n++;
  }
  audit(u.id, "group", groupId, `import calendar ${n} matches${errors.length ? `, ${errors.length} unmatched` : ""}`);
  revalidateAll();
}

export async function saveTeamGroupList(fd: FormData) {
  // add teams to a group of the active season by name, one per line
  const u = await requireUser("admin");
  const groupId = Number(fd.get("groupId"));
  const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const season = db.select().from(schema.seasons).where(eq(schema.seasons.active, true)).get()!;
  let n = 0;
  for (const line of str(fd, "text").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const base = slugify(line); let slug = base; let k = 1;
    while (db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).get()) slug = `${base}-${season.name.replace(/[^0-9a-z]/gi, "").toLowerCase()}${k > 1 ? "-" + k : ""}`, k++;
    db.insert(schema.teams).values({ groupId, name: line, slug }).run(); n++;
  }
  audit(u.id, "group", groupId, `add ${n} teams`); revalidateAll();
}

/* ---------- announcement popup (admin only) ---------- */
export async function savePopup(fd: FormData) {
  const u = await requireUser("admin");
  if (!isAdmin(u.role)) return;
  const set = (key: string, value: string) => db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } }).run();
  const img = fd.get("image") as File | null;
  if (img && img.size > 0) {
    const buf = Buffer.from(await img.arrayBuffer());
    fs.mkdirSync(path.join(UPLOAD_DIR, "popup"), { recursive: true });
    const name = `popup/p-${Date.now().toString(36)}.jpg`;
    await sharp(buf).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(UPLOAD_DIR, name));
    set("popup_image", name);
  }
  if (bool(fd, "removeImage")) set("popup_image", "");
  set("popup_enabled", bool(fd, "enabled") ? "1" : "0");
  set("popup_title", str(fd, "title"));
  set("popup_body", str(fd, "body"));
  set("popup_from", str(fd, "from"));
  set("popup_to", str(fd, "to"));
  if (bool(fd, "bump")) set("popup_version", Date.now().toString(36)); // show again to everyone who dismissed it
  if (!db.select().from(schema.settings).where(eq(schema.settings.key, "popup_version")).get()) set("popup_version", Date.now().toString(36));
  audit(u.id, "popup", null, bool(fd, "enabled") ? "on" : "off"); revalidateAll();
}

/* ---------- team gallery ---------- */
export async function addTeamPhoto(fd: FormData) {
  const teamId = Number(fd.get("teamId"));
  const { u } = await teamAccess(teamId);
  const team = db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).get(); if (!team) return;
  const files = (fd.getAll("photos") as File[]).filter((f) => f && f.size > 0);
  const season = str(fd, "season") || "";
  if (!files.length || !season) return;
  fs.mkdirSync(path.join(UPLOAD_DIR, "gallery"), { recursive: true });
  let i = 0;
  for (const f of files) {
    const name = `gallery/${teamKey(team.name)}-${Date.now().toString(36)}-${i++}.jpg`;
    await sharp(Buffer.from(await f.arrayBuffer())).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(UPLOAD_DIR, name));
    db.insert(schema.teamPhotos).values({ teamKey: teamKey(team.name), season, file: name, caption: str(fd, "caption") || null }).run();
  }
  audit(u.id, "team", teamId, `gallery +${files.length}`); revalidateAll();
}
export async function deleteTeamPhoto(fd: FormData) {
  const teamId = Number(fd.get("teamId")); const id = Number(fd.get("id"));
  const { u } = await teamAccess(teamId);
  db.delete(schema.teamPhotos).where(eq(schema.teamPhotos.id, id)).run();
  audit(u.id, "team", teamId, `gallery -${id}`); revalidateAll();
}

/* ---------- referees ---------- */
export async function saveReferee(fd: FormData) {
  const u = await requireUser("content"); const id = num(fd, "id");
  const row = { name: str(fd, "name"), phone: str(fd, "phone") || null, active: fd.has("active") ? bool(fd, "active") : true, notes: str(fd, "notes") || null };
  if (!row.name) return;
  if (id) db.update(schema.referees).set(row).where(eq(schema.referees.id, id)).run(); else db.insert(schema.referees).values(row).run();
  audit(u.id, "referee", id, id ? "update" : "create"); revalidateAll();
}
export async function deleteReferee(fd: FormData) {
  const u = await requireUser("content"); const id = Number(fd.get("id"));
  db.update(schema.matches).set({ refereeId: null }).where(eq(schema.matches.refereeId, id)).run();
  db.delete(schema.referees).where(eq(schema.referees.id, id)).run();
  audit(u.id, "referee", id, "delete"); revalidateAll();
}
export async function assignReferees(fd: FormData) {
  const u = await requireUser("content");
  const ids = fd.getAll("matchId").map(Number);
  for (const id of ids) { const r = num(fd, `ref_${id}`); db.update(schema.matches).set({ refereeId: r }).where(eq(schema.matches.id, id)).run(); }
  audit(u.id, "round", null, `referees ${ids.length}`); revalidateAll();
}

/* ---------- quick score (phone) ---------- */
export async function quickScore(fd: FormData) {
  const u = await requireUser("content");
  const id = Number(fd.get("matchId")); const hg = num(fd, "hg"); const ag = num(fd, "ag"); const publish = bool(fd, "publish");
  if (!id || hg == null || ag == null) return;
  const before = db.select().from(schema.matches).where(eq(schema.matches.id, id)).get();
  db.update(schema.matches).set({ status: "played", homeGoals: hg, awayGoals: ag, published: publish, updatedBy: u.id, updatedAt: new Date().toISOString() }).where(eq(schema.matches.id, id)).run();
  audit(u.id, "match", id, `quick ${hg}-${ag}${publish ? "" : " (esborrany)"}`); revalidateAll();
  if (publish && before && (!before.published || before.status !== "played" || before.homeGoals !== hg || before.awayGoals !== ag)) void notifyResult(id);
}

/* ---------- push helpers ---------- */
async function notifyResult(matchId: number) {
  const m = db.select().from(schema.matches).where(eq(schema.matches.id, matchId)).get(); if (!m) return;
  const home = db.select().from(schema.teams).where(eq(schema.teams.id, m.homeId)).get()!, away = db.select().from(schema.teams).where(eq(schema.teams.id, m.awayId)).get()!;
  const round = db.select().from(schema.rounds).where(eq(schema.rounds.id, m.roundId)).get()!;
  const group = db.select().from(schema.groups).where(eq(schema.groups.id, round.groupId)).get()!;
  await notifyMatch([home.name, away.name], group.name, { title: `${home.name} ${m.homeGoals}–${m.awayGoals} ${away.name}`, body: `Resultat · Jornada ${round.number} · Grup ${group.name}`, url: `/partit/${m.id}`, tag: `match-${m.id}` });
}
async function notifySchedule(matchId: number, date: string | null, time: string | null, field: string | null) {
  const m = db.select().from(schema.matches).where(eq(schema.matches.id, matchId)).get(); if (!m) return;
  const home = db.select().from(schema.teams).where(eq(schema.teams.id, m.homeId)).get()!, away = db.select().from(schema.teams).where(eq(schema.teams.id, m.awayId)).get()!;
  const round = db.select().from(schema.rounds).where(eq(schema.rounds.id, m.roundId)).get()!;
  const group = db.select().from(schema.groups).where(eq(schema.groups.id, round.groupId)).get()!;
  await notifyMatch([home.name, away.name], group.name, { title: `Canvi d'horari · ${home.name} – ${away.name}`, body: `J${round.number} · ${date ?? round.date}${time ? ` · ${time}` : ""}${field || home.field ? ` · ${field || home.field}` : ""}`, url: `/partit/${m.id}`, tag: `sched-${m.id}` });
}
export async function pushBroadcast(fd: FormData) {
  const u = await requireUser("content");
  const title = str(fd, "title"), body = str(fd, "body"), url = str(fd, "url") || "/";
  if (!title) return;
  const n = await notifyAll({ title, body, url, tag: `bc-${Date.now()}` });
  audit(u.id, "push", null, `broadcast ${n}`);
}

/* ---------- publish drafts ---------- */
export async function publishMatches(fd: FormData) {
  const u = await requireUser("content");
  const ids = fd.getAll("matchId").map(Number).filter(Boolean);
  const toNotify: number[] = [];
  for (const id of ids) {
    const m = db.select().from(schema.matches).where(eq(schema.matches.id, id)).get();
    if (!m || m.published || (m.status !== "played" && m.status !== "walkover")) continue;
    db.update(schema.matches).set({ published: true, updatedBy: u.id, updatedAt: new Date().toISOString() }).where(eq(schema.matches.id, id)).run();
    toNotify.push(id);
  }
  audit(u.id, "round", null, `publish ${toNotify.length}`); revalidateAll();
  for (const id of toNotify) void notifyResult(id);
}
export async function unpublishMatch(fd: FormData) {
  const u = await requireUser("content"); const id = Number(fd.get("matchId"));
  db.update(schema.matches).set({ published: false }).where(eq(schema.matches.id, id)).run();
  audit(u.id, "match", id, "unpublish"); revalidateAll();
}

/* ---------- error reports (public form) ---------- */
export async function sendReport(fd: FormData) {
  const message = str(fd, "message").slice(0, 1000); const contact = str(fd, "contact").slice(0, 120); const matchId = num(fd, "matchId");
  if (message.length < 5 || str(fd, "website")) return; // honeypot
  db.insert(schema.reports).values({ matchId, message, contact: contact || null, createdAt: new Date().toISOString() }).run();
  revalidatePath("/admin");
}
export async function resolveReport(fd: FormData) {
  const u = await requireUser("content"); const id = Number(fd.get("id"));
  db.update(schema.reports).set({ resolved: !bool(fd, "reopen") }).where(eq(schema.reports.id, id)).run();
  audit(u.id, "report", id, "resolve"); revalidateAll();
}

/* ---------- referee ratings (delegates only, 1-5, optional protest) ---------- */
export async function rateReferee(fd: FormData) {
  const u = await requireUser();
  if (u.role !== "delegat" || !u.teamId) return; // only the two delegates (one per side) can rate
  const matchId = Number(fd.get("matchId")); const score = Math.min(5, Math.max(1, num(fd, "score") ?? 0));
  const protest = bool(fd, "protest"); const comment = protest ? (str(fd, "comment").slice(0, 600) || null) : null;
  const m = db.select().from(schema.matches).where(eq(schema.matches.id, matchId)).get();
  if (!m || !m.refereeId || (m.status !== "played" && m.status !== "walkover")) return;
  if (u.teamId !== m.homeId && u.teamId !== m.awayId) return;
  const existing = db.select().from(schema.refereeRatings).where(and(eq(schema.refereeRatings.matchId, matchId), eq(schema.refereeRatings.teamId, u.teamId))).get();
  if (existing) db.update(schema.refereeRatings).set({ score, protest, comment, userId: u.id, refereeId: m.refereeId }).where(eq(schema.refereeRatings.id, existing.id)).run();
  else db.insert(schema.refereeRatings).values({ matchId, refereeId: m.refereeId, teamId: u.teamId, userId: u.id, score, protest, comment, createdAt: new Date().toISOString() }).run();
  audit(u.id, "referee_rating", matchId, `${score}${protest ? " PROTESTA" : ""}`); revalidateAll();
}
