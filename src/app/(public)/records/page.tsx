import Link from "next/link";
import { getT, fmtDate } from "@/lib/i18n";
import { records } from "@/lib/records";
import { getSeason, matchDate, playerLabel } from "@/lib/stats";
import { TeamLink } from "@/components/public";

export const dynamic = "force-dynamic";

export default async function RecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { lang, t } = await getT();
  const season = getSeason();
  const allTime = sp.t === "tots";
  const r = records(allTime ? null : season.id);
  const sub = (s: { name: string }) => allTime ? <span className="gk"> · {s.name}</span> : null;

  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rec-block"><h3>{title}</h3>{children}</div>
  );
  const Empty = () => <p className="gk" style={{ margin: 0 }}>—</p>;

  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <h1>{t.records}</h1>
          <div className="seg"><Link className={!allTime ? "on" : ""} href="/records">{t.temporada} {season.name}</Link><Link className={allTime ? "on" : ""} href="/records?t=tots">{t.totsElsTemps}</Link></div>
          <span className="gk" style={{ marginLeft: "auto" }}>{r.matchesCount} {t.partits.toLowerCase()}</span>
        </div>
        {r.matchesCount === 0 ? <p className="empty">{t.capJornadaJugada}</p> : (
          <div className="rec-grid">
            {allTime && r.champions.length > 0 && (
              <Block title={t.campions}>
                <ul className="rec-list">{r.champions.map((c, i) => <li key={i}><span className="rec-val">{c.season.name}</span><span>{t.grup} {c.group.name}: <TeamLink team={c.team} plain />{!c.complete && <span className="gk"> ({t.enCurs})</span>}</span></li>)}</ul>
              </Block>
            )}
            <Block title={t.recTopScorer}>{r.topScorers.length ? <ul className="rec-list">{r.topScorers.map((x, i) => <li key={i}><span className="rec-val">{x.value}</span><span><Link className="plink" href={`/jugador/${x.player.id}`}>{playerLabel(x.player)}</Link> <span className="gk">· {x.team.name}</span>{sub(x.season)}</span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recHatTricks}>{r.hatTricks.length ? <ul className="rec-list">{r.hatTricks.map((x, i) => { const m = r.matchById.get(x.matchId!); return <li key={i}><span className="rec-val">{x.value}</span><span><Link className="plink" href={`/jugador/${x.player.id}`}>{playerLabel(x.player)}</Link> <span className="gk">· {x.team.name}</span>{m && <> · <Link href={`/partit/${m.id}`}>{m.home.name} {m.homeGoals}–{m.awayGoals} {m.away.name}</Link></>}</span></li>; })}</ul> : <Empty />}</Block>
            <Block title={t.recBestGk}>{r.bestGk.length ? <ul className="rec-list">{r.bestGk.map((x, i) => <li key={i}><span className="rec-val">{x.value.toFixed(2)}</span><span><Link className="plink" href={`/jugador/${x.player.id}`}>{playerLabel(x.player)}</Link> <span className="gk">· {x.team.name} · {x.pj} {t.pj} · {x.cs} {t.porteriaZero}</span>{sub(x.season)}</span></li>)}</ul> : <p className="gk" style={{ margin: 0 }}>{t.min3}</p>}</Block>
            <Block title={t.recCleanSheets}>{r.cleanSheetGk.length ? <ul className="rec-list">{r.cleanSheetGk.map((x, i) => <li key={i}><span className="rec-val">{x.value}</span><span><Link className="plink" href={`/jugador/${x.player.id}`}>{playerLabel(x.player)}</Link> <span className="gk">· {x.team.name}</span>{sub(x.season)}</span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recBiggestWin}>{r.biggestWin.length ? <ul className="rec-list">{r.biggestWin.map((x, i) => <li key={i}><span className="rec-val">+{x.value}</span><span><Link href={`/partit/${x.match.id}`}>{x.match.home.name} <b>{x.match.homeGoals}–{x.match.awayGoals}</b> {x.match.away.name}</Link> <span className="gk">· J{x.match.round.number} · {fmtDate(matchDate(x.match), lang, allTime)}</span></span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recMostGoalsMatch}>{r.mostGoals.length ? <ul className="rec-list">{r.mostGoals.map((x, i) => <li key={i}><span className="rec-val">{x.value}</span><span><Link href={`/partit/${x.match.id}`}>{x.match.home.name} <b>{x.match.homeGoals}–{x.match.awayGoals}</b> {x.match.away.name}</Link> <span className="gk">· J{x.match.round.number} · {fmtDate(matchDate(x.match), lang, allTime)}</span></span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recUnbeaten}>{r.longestUnbeaten.length ? <ul className="rec-list">{r.longestUnbeaten.map((x, i) => <li key={i}><span className="rec-val">{x.value}</span><span><TeamLink team={x.team} plain /> <span className="gk">· {t.grup} {x.group.name}</span>{sub(x.season)}</span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recWinStreak}>{r.longestWin.length ? <ul className="rec-list">{r.longestWin.map((x, i) => <li key={i}><span className="rec-val">{x.value}</span><span><TeamLink team={x.team} plain /> <span className="gk">· {t.grup} {x.group.name}</span>{sub(x.season)}</span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recAttack}>{r.mostGoalsTeam.length ? <ul className="rec-list">{r.mostGoalsTeam.map((x, i) => <li key={i}><span className="rec-val">{x.value}</span><span><TeamLink team={x.team} plain /> <span className="gk">· {x.sum.seq.length} {t.pj}</span>{sub(x.season)}</span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recDefense}>{r.bestDefense.length ? <ul className="rec-list">{r.bestDefense.map((x, i) => <li key={i}><span className="rec-val">{x.value.toFixed(2)}</span><span><TeamLink team={x.team} plain /> <span className="gk">· {x.sum.all.ga} {t.gc} / {x.sum.seq.length} {t.pj} · {x.sum.cleanSheets} {t.porteriaZero}</span>{sub(x.season)}</span></li>)}</ul> : <p className="gk" style={{ margin: 0 }}>{t.min3}</p>}</Block>
            <Block title={t.recMostApps}>{r.mostApps.length ? <ul className="rec-list">{r.mostApps.map((x, i) => <li key={i}><span className="rec-val">{x.value}</span><span><Link className="plink" href={`/jugador/${x.player.id}`}>{playerLabel(x.player)}</Link> <span className="gk">· {x.team.name}</span>{sub(x.season)}</span></li>)}</ul> : <Empty />}</Block>
            <Block title={t.recCards}>{r.mostCards.length ? <ul className="rec-list">{r.mostCards.map((x, i) => <li key={i}><span className="rec-val">{x.value}<i className="card y" style={{ marginLeft: 4 }} />{x.reds ? <> {x.reds}<i className="card r" style={{ marginLeft: 4 }} /></> : null}</span><span><Link className="plink" href={`/jugador/${x.player.id}`}>{playerLabel(x.player)}</Link> <span className="gk">· {x.team.name}</span>{sub(x.season)}</span></li>)}</ul> : <Empty />}</Block>
          </div>
        )}
      </div>
    </>
  );
}
