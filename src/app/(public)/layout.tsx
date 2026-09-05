import Link from "next/link";
import { getT, fmtDate } from "@/lib/i18n";
import { getSeason, getGroups, loadGroup, siteLogo, getAllSeasons, isArchive, popupSettings } from "@/lib/stats";
import { Popup } from "@/components/Popup";
import { WebcalFix } from "@/components/WebcalFix";
import { Hit } from "@/components/Hit";
import { getUser } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getT();
  const season = getSeason();
  const groups = getGroups();
  const user = await getUser();
  const next = groups.map((g) => ({ g, d: loadGroup(g.id) }));
  const nextRound = next[0]?.d.rounds.find((r) => r.number === next[0].d.nextRound);
  const seasons = getAllSeasons();
  const archive = isArchive();
  const popup = popupSettings();

  return (
    <>
      <div className="senyera" aria-hidden="true" />
      <header className="site-top">
        <div className="wrap">
          <Link className="brand" href="/">
            <img src={siteLogo()} alt="" width={44} height={44} />
            <span>{t.siteName}<small>{t.tagline}</small></span>
          </Link>
          <nav className="main">
            <div><Link className="item" href="/">{t.inici}</Link></div>
            <div>
              <span className="item" tabIndex={0}>{t.lliga} ▾</span>
              <div className="dd">
                {groups.map((g) => <Link key={g.id} href={`/lliga/${g.name.toLowerCase()}`}>{t.grup} {g.name}</Link>)}
                <Link href="/calendari">{t.calendari}</Link>
                <Link href="/resultats">{t.resultats}</Link>
                <Link href="/golejadors">{t.golejadors}</Link>
                <Link href="/sancions">{t.sancions}</Link>
                <Link href="/records">{t.records}</Link>
                <Link href="/cerca">{t.cerca}</Link>
                <Link href="/arxiu">{t.arxiu} · {t.temporades}</Link>
              </div>
            </div>
            <div>
              <span className="item" tabIndex={0}>{t.normatives} ▾</span>
              <div className="dd">
                <Link href="/normatives/normativa">{t.normativa}</Link>
                <Link href="/normatives/reglament">{t.reglament}</Link>
                <Link href="/normatives/arbitratges">{t.arbitratges}</Link>
                <Link href="/normatives/documentacio">{t.documentacio}</Link>
                <Link href="/normatives/circulars">{t.circulars}</Link>
              </div>
            </div>
            <div><Link className="item" href="/contacte">{t.contacte}</Link></div>
          </nav>
          {nextRound && <Link className="next-pill" href={`/calendari/${groups[0]?.name.toLowerCase() ?? "a"}`}><span className="np-lab">{t.properaJornada} · </span>J{nextRound.number} · {fmtDate(nextRound.date, lang, false)}</Link>}
        </div>
      </header>
      <div className="season-strip">
        <div className="wrap">
          {seasons.length > 1 ? (
            <form action="/temporada/go" className="season-pick"><select name="id" defaultValue={season.id} aria-label={t.temporada}>{seasons.map((s) => <option key={s.id} value={s.id}>{t.temporada} {s.name}</option>)}</select><button className="btn sm ghost">→</button></form>
          ) : <span>{t.temporada} {season.name}</span>}
          {next.map(({ g, d }) => <span key={g.id}><b>{t.grup} {g.name}</b> · {d.teams.length} {t.equips}</span>)}
          <span><b>{next[0]?.d.rounds.length ?? 0}</b> {t.jornades}</span>
          <form action="/cerca" className="search"><input name="q" placeholder={t.cercaPh} aria-label={t.cerca} /></form>
          <div className="lang" role="group" aria-label="Idioma">
            <a className={lang === "ca" ? "on" : ""} href="/lang/ca">CA</a>
            <a className={lang === "es" ? "on" : ""} href="/lang/es">ES</a>
          </div>
          <span>{user ? <Link href="/admin">{t.admin}</Link> : <Link href="/admin/login">{t.entrar}</Link>}</span>
        </div>
      </div>
      {archive && <div className="archive-banner"><div className="wrap"><span>{t.arxiuBanner} <b>{season.name}</b></span><Link href="/temporada/actual?to=/">{t.tornaActual} →</Link></div></div>}
      <main className="site"><div className="wrap">{children}</div></main>
      <WebcalFix />
      <Hit />
      {popup && <Popup id={popup.id} title={popup.title} body={popup.body} image={popup.image} closeLabel={t.tancar} />}
      <footer className="site"><div className="wrap">
        <span>{t.peu} · {t.temporada} {season.name}</span>
        <a className="credit" href="https://zintex.dev" target="_blank" rel="noopener">{t.desenvolupatPer} <img src="/zintex.svg" alt="Zintex" /></a>
      </div></footer>
    </>
  );
}
