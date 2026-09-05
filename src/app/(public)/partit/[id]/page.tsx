import Link from "next/link";
import { notFound } from "next/navigation";
import { getT, fmtDate } from "@/lib/i18n";
import { matchDetails, matchDate, playerLabel, getGroups, type Player } from "@/lib/stats";
import { getUser, canEditMatches } from "@/lib/auth";
import { FixtureList, MapLink } from "@/components/public";
import { ReportForm } from "@/components/ReportForm";
import { refereeStats } from "@/lib/referees";
import { Stars } from "@/components/Stars";
import { rateReferee } from "@/lib/actions";
import { and } from "drizzle-orm";
import { headToHead } from "@/lib/records";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = matchDetails(Number(id));
  if (!d) return {};
  const m = d.match;
  const played = (m.status === "played" || m.status === "walkover") && m.homeGoals != null && m.published;
  const title = played ? `${m.home.name} ${m.homeGoals}–${m.awayGoals} ${m.away.name}` : `${m.home.name} – ${m.away.name}`;
  const desc = `Jornada ${m.round.number} · ${matchDate(m)}${m.time ? ` · ${m.time}` : ""}${m.field || m.home.field ? ` · ${m.field || m.home.field}` : ""}`;
  return { title, description: desc, openGraph: { title, description: desc, type: "article", images: [{ url: `/og/partit/${m.id}`, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title, description: desc } };
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang, t } = await getT();
  const d = matchDetails(Number(id));
  if (!d) notFound();
  const { match: m, apps, events, players } = d;
  const user = await getUser();
  const groupName = (getGroups().find((g) => g.id === m.home.groupId)?.name ?? "a").toLowerCase();
  const played = (m.status === "played" || m.status === "walkover") && m.published;
  const h2h = headToHead(m.home, m.away);
  const refName = m.refereeId ? db.select().from(schema.referees).where(eq(schema.referees.id, m.refereeId)).get()?.name : null;
  const rs = m.refereeId ? refereeStats(m.refereeId) : null;
  const canRate = !!user && user.role === "delegat" && (m.status === "played" || m.status === "walkover") && !!m.refereeId && (user.teamId === m.homeId || user.teamId === m.awayId);
  const myTeamId = user?.role === "delegat" ? user.teamId : null;
  const myRating = canRate && myTeamId ? db.select().from(schema.refereeRatings).where(and(eq(schema.refereeRatings.matchId, m.id), eq(schema.refereeRatings.teamId, myTeamId))).get() : null;
  const prev = h2h.meetings.filter((x) => x.id !== m.id).slice(0, 6);
  const P = (pid: number) => players.get(pid);
  const side = (p: Player | undefined) => (p?.teamId === m.homeId ? "h" : "a");
  const goals = events.filter((e) => e.type === "gol" || e.type === "gol_pen");
  const cards = events.filter((e) => e.type === "groga" || e.type === "vermella" || e.type === "segona_groga");
  const lineup = (teamId: number) => {
    const list = apps.map((a) => ({ a, p: P(a.playerId)! })).filter((x) => x.p && x.p.teamId === teamId);
    const sortP = (x: { p: Player }, y: { p: Player }) => (x.p.dorsal ?? 999) - (y.p.dorsal ?? 999);
    return { tit: list.filter((x) => x.a.role === "titular").sort(sortP), sup: list.filter((x) => x.a.role !== "titular").sort(sortP) };
  };
  const H = lineup(m.homeId), A = lineup(m.awayId);
  const Ev = ({ e }: { e: typeof events[number] }) => {
    const p = P(e.playerId); const s = side(p);
    const label = <><Link className="plink" href={`/jugador/${e.playerId}`}>{playerLabel(p)}</Link>{e.type === "gol_pen" ? ` (${t.pen})` : ""}{e.assistId ? <span className="gk"> · {playerLabel(P(e.assistId))}</span> : ""}</>;
    const icon = e.type === "groga" ? <span className="card y" /> : e.type === "vermella" ? <span className="card r" /> : e.type === "segona_groga" ? <><span className="card y" /><span className="card r" /></> : "⚽";
    return <li style={{ textAlign: s === "h" ? "left" : "right" }}><span className="min">{e.minute != null ? `${e.minute}'` : ""}</span>{icon} {label}</li>;
  };
  return (
    <div className="panel">
      <div className="panel-h"><h1>{t.acta} · {t.jornada} {m.round.number}</h1><span style={{ marginLeft: "auto", color: "var(--ink2)" }}>{fmtDate(matchDate(m), lang)}{m.time ? ` · ${m.time}` : ""}</span>
        {user && canEditMatches(user.role) && <Link className="btn sm ghost" href={`/admin/partits/${m.id}`}>✎</Link>}</div>
      <div className="score-big">
        <div className="t"><Link href={`/equip/${m.home.slug}`}>{m.home.name}</Link></div>
        <div className="n">{played ? `${m.homeGoals}–${m.awayGoals}` : m.status === "postponed" ? t.ajornat : (m.time || t.horaPerConfirmar)}</div>
        <div className="t"><Link href={`/equip/${m.away.slug}`}>{m.away.name}</Link></div>
      </div>
      {played && (
        <>
          <div className="events">
            <div><h4>{t.gols}</h4><ul>{goals.length ? goals.map((e) => <Ev key={e.id} e={e} />) : <li>—</li>}</ul></div>
            <div><h4>{t.targetes}</h4><ul>{cards.length ? cards.map((e) => <Ev key={e.id} e={e} />) : <li>—</li>}</ul></div>
          </div>
          {(H.tit.length + A.tit.length + H.sup.length + A.sup.length) > 0 && (
            <div className="lineups">
              {[{ L: H, team: m.home }, { L: A, team: m.away }].map(({ L, team }) => (
                <div key={team.id}>
                  <h4 style={{ margin: "0 0 6px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink2)" }}>{team.name} · {t.titulars}</h4>
                  <ul>{L.tit.map(({ p }) => <li key={p.id}><span className="dor">{p.dorsal ?? ""}</span><Link className="plink" href={`/jugador/${p.id}`}>{playerLabel(p)}</Link>{p.position === "POR" ? <span className="gk"> (POR)</span> : ""}</li>)}</ul>
                  {L.sup.length > 0 && <><h4 style={{ margin: "10px 0 6px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink2)" }}>{t.suplents}</h4>
                    <ul>{L.sup.map(({ p, a }) => <li key={p.id} style={{ opacity: a.entered ? 1 : .6 }}><span className="dor">{p.dorsal ?? ""}</span><Link className="plink" href={`/jugador/${p.id}`}>{playerLabel(p)}</Link>{a.entered ? " ↑" : ""}</li>)}</ul></>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {h2h.meetings.length > 0 && (
        <>
          <div className="panel-h" style={{ borderTop: "1px solid var(--line)" }}><h2>{t.h2h}</h2><span className="gk" style={{ marginLeft: "auto" }}>{h2h.meetings.length} {t.enfrontaments}</span></div>
          <div className="h2h">
            <div><b>{h2h.wa}</b><small>{t.victories} {m.home.name}</small></div>
            <div className="d"><b>{h2h.d}</b><small>{t.empats}</small></div>
            <div><b>{h2h.wb}</b><small>{t.victories} {m.away.name}</small></div>
          </div>
          {prev.length > 0 && <div className="panel-b" style={{ paddingTop: 0 }}><FixtureList matches={prev} t={t} lang={lang} showDate /></div>}
        </>
      )}
      {rs && (
        <div className="ref-box" id="arbitre">
          <div className="ref-name"><span className="gk">{t.arbitre}</span><b>{rs.referee.name}</b></div>
          <div className="ref-stats">
            <div><b className="stars" title={rs.avgRating != null ? rs.avgRating.toFixed(2) : ""}>{rs.avgRating != null ? <Stars value={rs.avgRating} size={22} /> : "—"}</b><span>{t.valoracio}{rs.avgRating != null ? ` ${rs.avgRating.toFixed(1)} (${rs.ratings})` : ""}</span></div>
            <div><b>{rs.matches}</b><span>{t.partits}</span></div>
            <div><b>{rs.yellowsPerMatch.toFixed(1)}</b><span><i className="card y" /> / {t.partit.toLowerCase()}</span></div>
            <div><b>{rs.redsPerMatch.toFixed(1)}</b><span><i className="card r" /> / {t.partit.toLowerCase()}</span></div>
          </div>
          {canRate && (
            <form action={rateReferee} className="ref-rate">
              <input type="hidden" name="matchId" value={m.id} />
              <label>{t.valoraArbitre}</label>
              <div className="star-input">{[5, 4, 3, 2, 1].map((n) => <label key={n} title={String(n)}><input type="radio" name="score" value={n} defaultChecked={myRating?.score === n} required /><span>★</span></label>)}</div>
              <details className="protest" open={!!myRating?.protest}><summary>{t.presentarProtesta}</summary>
                <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)" }}><input type="checkbox" name="protest" defaultChecked={!!myRating?.protest} /> {t.protestaCheck}</label>
                <textarea name="comment" rows={3} placeholder={t.protestaPh} defaultValue={myRating?.comment ?? ""} />
              </details>
              <button className="btn sm">{myRating ? t.actualitzar : t.enviar}</button>
              {myRating?.protest && <span className="tag red">{t.protestaPresentada}</span>}
            </form>
          )}
        </div>
      )}
      <div className="mfoot">
        {(m.field || m.home.field) && <span>{t.camp}: <MapLink field={(m.field || m.home.field)!} town={m.home.town} hint={m.home.info} /></span>}
        {!rs && (refName || m.referee) && <span>{t.arbitre}: {refName || m.referee}</span>}
        {m.notes && <span>{m.notes}</span>}
        <Link href={`/resultats/${groupName}?j=${m.round.number}`} style={{ marginLeft: "auto" }}>{t.resultats} J{m.round.number} →</Link>
      </div>
      {played && <div style={{ padding: "0 24px 18px" }}><ReportForm matchId={m.id} t={t} /></div>}
    </div>
  );
}
