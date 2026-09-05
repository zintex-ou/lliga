import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { matchDetails, isSuspendedFor, getActiveSeason, getGroupsAdmin, loadGroup } from "@/lib/stats";
import { fmtDate } from "@/lib/i18n";
import { ActaEditor, type SquadPlayer } from "@/components/ActaEditor";

export const dynamic = "force-dynamic";

export default async function ActaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("content");
  const { id } = await params;
  const d = matchDetails(Number(id));
  if (!d) notFound();
  const { match: m, apps, events } = d;
  const season = getActiveSeason();
  const group = getGroupsAdmin().find((g) => g.id === m.home.groupId)!;
  const squad = (teamId: number, team: typeof m.home): SquadPlayer[] =>
    db.select().from(schema.players).where(eq(schema.players.teamId, teamId)).orderBy(asc(schema.players.dorsal)).all()
      .filter((p) => p.active || apps.some((a) => a.playerId === p.id))
      .map((p) => ({ id: p.id, label: `${p.dorsal != null ? p.dorsal + " · " : ""}${p.surname}${p.name ? " " + p.name : ""}`, position: p.position, suspended: isSuspendedFor(team, p.id, m) }));
  const other = db.select().from(schema.matches).where(eq(schema.matches.roundId, m.roundId)).all();
  const idx = other.findIndex((x) => x.id === m.id);
  return (
    <>
      <div className="actions" style={{ marginTop: 0 }}>
        <Link href={`/admin/partits?g=${group.name}&j=${m.round.number}`}>← Jornada {m.round.number} · Grup {group.name}</Link>
        <span style={{ marginLeft: "auto" }} />
        {idx > 0 && <Link className="btn ghost sm" href={`/admin/partits/${other[idx - 1].id}`}>‹ Partit anterior</Link>}
        {idx < other.length - 1 && <Link className="btn ghost sm" href={`/admin/partits/${other[idx + 1].id}`}>Partit següent ›</Link>}
      </div>
      <h1>Acta · J{m.round.number} · {m.home.name} – {m.away.name}</h1>
      <p className="gk" style={{ marginTop: -8 }}>{fmtDate(m.round.date, "ca")}{m.updatedAt ? ` · última edició ${m.updatedAt.replace("T", " ").slice(0, 16)}` : ""}</p>
      <ActaEditor
        match={{ id: m.id, status: m.status as "played", homeGoals: m.homeGoals, awayGoals: m.awayGoals, date: m.date, time: m.time, field: m.field ?? m.home.field ?? "", referee: m.referee, refereeId: m.refereeId, notes: m.notes, roundDate: m.round.date, published: m.published }}
        home={{ id: m.home.id, name: m.home.name, squad: squad(m.home.id, m.home) }}
        away={{ id: m.away.id, name: m.away.name, squad: squad(m.away.id, m.away) }}
        apps={apps.map((a) => ({ playerId: a.playerId, role: a.role as "titular", entered: a.entered, conceded: a.conceded }))}
        events={events.map((e) => ({ playerId: e.playerId, type: e.type, minute: e.minute, assistId: e.assistId }))}
        sanctions={db.select().from(schema.sanctions).all().filter((s) => s.matchId === m.id).map((s) => ({ eventPlayerId: s.playerId, matches: s.matches, reason: s.reason }))}
        assistsEnabled={season.assistsEnabled}
        referees={db.select().from(schema.referees).where(eq(schema.referees.active, true)).all().map((r) => ({ id: r.id, name: r.name }))}
        fields={[...new Set(getGroupsAdmin().flatMap((g) => [...loadGroup(g.id).teams.map((t) => t.field), ...loadGroup(g.id).matches.map((x) => x.field)]).filter(Boolean) as string[])].sort()}
      />
    </>
  );
}
