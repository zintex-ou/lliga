import Link from "next/link";
import { requireUser, canEditMatches } from "@/lib/auth";
import { getGroupsAdmin, loadGroup, groupPlayerStats, playerLabel, getActiveSeason, teamPlayerStats, matchDate } from "@/lib/stats";
import { eq } from "drizzle-orm";
import { fmtDate } from "@/lib/i18n";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { changeOwnPassword } from "@/lib/actions";
import { refereeToken } from "@/lib/tokens";
import { WebcalFix } from "@/components/WebcalFix";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requireUser();
  const groups = getGroupsAdmin();
  const N = getActiveSeason().yellowsForBan;
  if (user.role === "arbitre") {
    const ref = user.refereeId ? db.select().from(schema.referees).where(eq(schema.referees.id, user.refereeId)).get() : null;
    const mine = ref ? groups.flatMap((g) => loadGroup(g.id, true).matches.filter((m) => m.refereeId === ref.id).map((m) => ({ ...m, g }))).sort((a, b) => matchDate(a).localeCompare(matchDate(b))) : [];
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
    const upcoming = mine.filter((m) => m.status !== "played" && m.status !== "walkover" && matchDate(m) >= today), past = mine.filter((m) => !upcoming.includes(m)).reverse();
    const token = refereeToken(ref?.id ?? 0);
    return (
      <>
        <h1>Hola, {user.name}</h1>
        {!ref && <div className="box">El teu compte no està vinculat a cap àrbitre. Demana-ho a l&apos;administrador.</div>}
        {ref && <>
          <div className="actions" style={{ marginTop: 0 }}><a className="btn sm ghost" href={`webcal://HOST/ical/arbitre/${token}.ics`} data-webcal>Afegir les meves designacions al calendari del mòbil</a><a className="btn sm ghost" href={`/ical/arbitre/${token}.ics`} download>Descarregar .ics</a></div>
          <h2>Properes designacions ({upcoming.length})</h2>
          <div className="box"><table className="mini"><thead><tr><th>Data</th><th>Hora</th><th>Grup</th><th>Partit</th><th>Camp</th></tr></thead><tbody>{upcoming.map((m) => <tr key={m.id}><td>{fmtDate(matchDate(m), "ca")}</td><td>{m.time || "—"}</td><td>{m.g.name} · J{m.round.number}</td><td><b>{m.home.name}</b> – <b>{m.away.name}</b></td><td>{m.field || m.home.field || "—"}</td></tr>)}{upcoming.length === 0 && <tr><td colSpan={5} className="gk">Cap designació pendent.</td></tr>}</tbody></table></div>
          <h2>Partits dirigits ({past.length})</h2>
          <div className="box"><table className="mini"><tbody>{past.slice(0, 30).map((m) => <tr key={m.id}><td>{fmtDate(matchDate(m), "ca")}</td><td>{m.g.name} · J{m.round.number}</td><td>{m.home.name} <b>{m.homeGoals ?? "–"}–{m.awayGoals ?? "–"}</b> {m.away.name}</td></tr>)}{past.length === 0 && <tr><td className="gk">—</td></tr>}</tbody></table></div>
        </>}
        <PasswordBox />
        <WebcalFix />
      </>
    );
  }
  if (!canEditMatches(user.role)) {
    const team = user.teamId ? db.select().from(schema.teams).where(eq(schema.teams.id, user.teamId)).get() : null;
    const stats = team ? teamPlayerStats(team) : [];
    const suspended = stats.filter((s) => s.remaining > 0);
    const atRisk = stats.filter((s) => s.remaining === 0 && s.player.active && s.yellows > 0 && s.yellows % N === N - 1);
    const next = team ? loadGroup(team.groupId, true).matches.filter((m) => (m.homeId === team.id || m.awayId === team.id) && m.status === "scheduled").sort((a, b) => matchDate(a).localeCompare(matchDate(b)))[0] : null;
    return (
      <>
        <h1>Hola, {user.name}</h1>
        {team && next && <div className="box"><b>Proper partit:</b> J{next.round.number} · {fmtDate(matchDate(next), "ca")}{next.time ? ` · ${next.time}` : " · hora per confirmar"} · {next.home.name} – {next.away.name} · {next.field || next.home.field || "camp per confirmar"}</div>}
        {(suspended.length > 0 || atRisk.length > 0) && (
          <div className="warn-box">
            {suspended.length > 0 && <p style={{ margin: "0 0 6px" }}><b>Sancionats:</b> {suspended.map((s) => `${playerLabel(s.player)} (${s.remaining})`).join(", ")}</p>}
            {atRisk.length > 0 && <p style={{ margin: 0 }}><b>A una groga de la sanció ({N} grogues):</b> {atRisk.map((s) => `${playerLabel(s.player)} (${s.yellows})`).join(", ")}</p>}
          </div>
        )}
        {team && (() => { const past = loadGroup(team.groupId).matches.filter((m) => (m.homeId === team.id || m.awayId === team.id) && (m.status === "played" || m.status === "walkover") && m.refereeId).sort((a, b) => matchDate(b).localeCompare(matchDate(a))).slice(0, 6); const rated = new Set(db.select().from(schema.refereeRatings).where(eq(schema.refereeRatings.teamId, team.id)).all().map((r) => r.matchId)); return past.length ? (
          <div className="box"><b>Valora l&apos;arbitratge</b> dels últims partits (1-5; si cal, presenta una protesta):<ul className="rowlist" style={{ marginTop: 6 }}>{past.map((m) => <li key={m.id}><span style={{ flex: 1 }}>J{m.round.number} · {m.home.name} {m.homeGoals}–{m.awayGoals} {m.away.name}</span>{rated.has(m.id) ? <span className="tag green">valorat</span> : <Link className="btn sm" href={`/partit/${m.id}#arbitre`}>Valorar</Link>}</li>)}</ul></div>) : null; })()}
        <div className="box">
          {team ? <p style={{ margin: 0 }}>Pots editar les fotos, la galeria i els delegats del teu equip: <Link href={`/admin/equips/${team.id}`}>obre el meu equip →</Link></p> : <p style={{ margin: 0 }}>El teu compte no té cap equip assignat.</p>}
        </div>
        <PasswordBox />
      </>
    );
  }
  const log = db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.id)).limit(8).all();
  const pendingReports = db.select().from(schema.reports).where(eq(schema.reports.resolved, false)).all().length;
  const protests = db.select().from(schema.refereeRatings).where(eq(schema.refereeRatings.protest, true)).all().length;
  const drafts = groups.reduce((a, g) => a + loadGroup(g.id, true).matches.filter((m) => !m.published && (m.status === "played" || m.status === "walkover")).length, 0);
  return (
    <>
      <h1>Tauler</h1>
      {(pendingReports > 0 || drafts > 0 || protests > 0) && <div className="warn-box">{drafts > 0 && <p style={{ margin: "0 0 4px" }}><b>{drafts}</b> resultats en esborrany pendents de publicar → <Link href="/admin/partits">Partits</Link></p>}{pendingReports > 0 && <p style={{ margin: 0 }}><b>{pendingReports}</b> avisos d&apos;error pendents → <Link href="/admin/avisos">Avisos</Link></p>}{protests > 0 && <p style={{ margin: "4px 0 0" }}><b>{protests}</b> protestes d&apos;arbitratge → <Link href="/admin/arbitres">Arbitratge</Link></p>}</div>}
      <div className="tiles">
        {groups.map((g) => {
          const d = loadGroup(g.id, true);
          const next = d.rounds.find((r) => r.number === d.nextRound);
          const pending = d.matches.filter((m) => m.round.number <= d.lastPlayedRound && m.status === "scheduled").length;
          const gs = groupPlayerStats(g.id);
          const suspended = gs.filter((s) => s.remaining > 0);
          const atRisk = gs.filter((s) => s.remaining === 0 && s.player.active && s.yellows > 0 && s.yellows % N === N - 1);
          return (
            <div key={g.id} style={{ display: "contents" }}>
              <Link className="tile" href={`/admin/rapid?g=${g.name}&j=${d.nextRound}`}><b>Grup {g.name} · J{d.nextRound}</b><span>Resultat ràpid · {next ? fmtDate(next.date, "ca") : "—"}</span></Link>
              <Link className="tile" href={`/admin/partits?g=${g.name}&j=${Math.max(1, d.lastPlayedRound)}`}><b>{d.lastPlayedRound} jornades jugades</b><span>{pending ? `${pending} partits pendents d'acta` : "Cap acta pendent"}</span></Link>
              <Link className="tile" href={`/admin/sancions`}><b>{suspended.length} sancionats · {atRisk.length} a una groga</b><span>{[...suspended.slice(0, 2).map((s) => playerLabel(s.player)), ...atRisk.slice(0, 2).map((s) => `${playerLabel(s.player)} (${s.yellows}🟨)`)].join(", ") || "Grup " + g.name}</span></Link>
            </div>
          );
        })}
      </div>
      <h2>Darrers canvis</h2>
      <div className="box"><ul className="rowlist">{log.map((l) => <li key={l.id}><span className="gk">{l.at.replace("T", " ").slice(0, 16)}</span><span>{l.entity}{l.entityId ? ` #${l.entityId}` : ""} · {l.action}</span></li>)}{log.length === 0 && <li className="gk">—</li>}</ul></div>
      <PasswordBox />
    </>
  );
}

function PasswordBox() {
  return (
    <details className="edit" style={{ marginTop: 18 }}><summary>Canviar la meva contrasenya</summary>
      <form action={changeOwnPassword} className="form" style={{ marginTop: 8, maxWidth: 400 }}>
        <div className="full"><label>Nova contrasenya (mín. 8 caràcters)</label><input name="password" type="password" minLength={8} required /></div>
        <div><button className="btn">Desar</button></div>
      </form>
    </details>
  );
}
