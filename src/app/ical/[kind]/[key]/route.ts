import { NextRequest } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getActiveSeason, loadGroup, matchDate, type MatchFull } from "@/lib/stats";
import { parseRefereeToken } from "@/lib/tokens";

/** iCalendar feed: /ical/equip/<slug>.ics or /ical/grup/<a|b>.ics — subscribe (webcal://) so phones refresh automatically. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; key: string }> }) {
  const { kind, key } = await params;
  const k = key.replace(/\.ics$/i, "");
  const season = getActiveSeason();
  let matches: MatchFull[] = []; let title = "Amics del futbol amateur";
  if (kind === "equip") {
    const team = db.select().from(schema.teams).where(eq(schema.teams.slug, k)).get();
    if (!team) return new Response("Not found", { status: 404 });
    matches = loadGroup(team.groupId).matches.filter((m) => m.homeId === team.id || m.awayId === team.id);
    title = `${team.name} · ${season.name}`;
  } else if (kind === "arbitre") {
    const rid = parseRefereeToken(k); if (!rid) return new Response("Not found", { status: 404 });
    const ref = db.select().from(schema.referees).where(eq(schema.referees.id, rid)).get(); if (!ref) return new Response("Not found", { status: 404 });
    const groups = db.select().from(schema.groups).where(eq(schema.groups.seasonId, season.id)).all();
    matches = groups.flatMap((g) => loadGroup(g.id, true).matches.filter((m) => m.refereeId === rid));
    title = `Designacions · ${ref.name}`;
  } else {
    const group = db.select().from(schema.groups).where(eq(schema.groups.seasonId, season.id)).all().find((g) => g.name.toLowerCase() === k.toLowerCase());
    if (!group) return new Response("Not found", { status: 404 });
    matches = loadGroup(group.id).matches;
    title = `FEG Grup ${group.name} · ${season.name}`;
  }
  const site = process.env.SITE_URL || new URL(req.url).origin;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Amics del futbol amateur//Lliga//CA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(title)}`, "X-WR-TIMEZONE:Europe/Madrid", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const m of matches) {
    if (m.status === "postponed" && !m.date) continue;
    const date = matchDate(m).replace(/-/g, "");
    const played = (m.status === "played" || m.status === "walkover") && m.homeGoals != null;
    const summary = played ? `${m.home.name} ${m.homeGoals}–${m.awayGoals} ${m.away.name}` : `${m.home.name} – ${m.away.name}`;
    const field = m.field || m.home.field || "";
    lines.push("BEGIN:VEVENT", `UID:feg-match-${m.id}@futbolempresesgirona`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(`⚽ J${m.round.number} · ${summary}`)}`);
    if (m.time) {
      const [h, mi] = m.time.split(":").map(Number);
      const end = `${String(h + 2).padStart(2, "0")}${String(mi).padStart(2, "0")}00`;
      lines.push(`DTSTART;TZID=Europe/Madrid:${date}T${String(h).padStart(2, "0")}${String(mi).padStart(2, "0")}00`, `DTEND;TZID=Europe/Madrid:${date}T${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${date}`);
    }
    if (field) lines.push(`LOCATION:${esc(field)}`);
    lines.push(`DESCRIPTION:${esc(`Jornada ${m.round.number}${m.time ? "" : " · hora per confirmar"}\n${site}/partit/${m.id}`)}`, `URL:${site}/partit/${m.id}`, `SEQUENCE:${m.updatedAt ? Math.floor(new Date(m.updatedAt).getTime() / 1000) % 100000 : 0}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=1800", "content-disposition": `inline; filename="${k}.ics"` } });
}
