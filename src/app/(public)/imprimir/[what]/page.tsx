import { getT, fmtDate } from "@/lib/i18n";
import { getSeason, loadGroup, standings, matchDate } from "@/lib/stats";
import { resolveGroup, parseRound } from "@/lib/group";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/** Print-ready pages: /imprimir/classificacio?g=b · /imprimir/jornada?g=b&j=3 · /imprimir/calendari?g=b — the browser's "Save as PDF" makes the PDF. */
export default async function Print({ params, searchParams }: { params: Promise<{ what: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { what } = await params; const sp = await searchParams;
  const { lang, t } = await getT();
  const season = getSeason();
  const group = await resolveGroup(sp.g);
  const d = loadGroup(group.id);
  const title = `${t.siteName} · ${t.temporada} ${season.name} · ${t.grup} ${group.name}`;
  return (
    <div className="print">
      <div className="print-tools"><PrintButton label={t.imprimirPdf} /> <a className="btn ghost sm" href={`/lliga/${group.name.toLowerCase()}`}>← {t.tornaLliga}</a></div>
      <header className="print-h"><img src="/logo.png" alt="" /><div><h1>{title}</h1><p>{what === "classificacio" ? t.classificacio : what === "jornada" ? `${t.jornada} ${parseRound(sp.j, d.nextRound, d.rounds.length)}` : t.calendari}</p></div></header>
      {what === "classificacio" && (
        <table className="print-t"><thead><tr><th></th><th>{t.equip}</th><th>{t.pj}</th><th>{t.g}</th><th>{t.e}</th><th>{t.p}</th><th>{t.gf}</th><th>{t.gc}</th><th>{t.dg}</th><th>{t.pts}</th></tr></thead>
          <tbody>{standings(group.id).map((r, k) => <tr key={r.team.id}><td>{k + 1}</td><td className="l">{r.team.name}</td><td>{r.pj}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.gc}</td><td>{r.gf - r.gc}</td><td><b>{r.pts}</b></td></tr>)}</tbody></table>
      )}
      {what === "jornada" && (() => { const j = parseRound(sp.j, d.nextRound, d.rounds.length); const ms = d.matches.filter((m) => m.round.number === j); return (
        <table className="print-t"><thead><tr><th>{t.hora}</th><th className="l">{t.partit}</th><th>{t.camp}</th></tr></thead>
          <tbody>{ms.map((m) => <tr key={m.id}><td>{fmtDate(matchDate(m), lang, false)}{m.time ? ` · ${m.time}` : ""}</td><td className="l">{m.home.name} {m.homeGoals != null ? <b>{m.homeGoals}–{m.awayGoals}</b> : "–"} {m.away.name}</td><td>{m.field || m.home.field || ""}</td></tr>)}</tbody></table>); })()}
      {what === "calendari" && d.rounds.map((r) => (
        <div key={r.id} className="print-round"><h3>{t.jornada} {r.number} · {fmtDate(r.date, lang)}{r.altDate ? ` (${fmtDate(r.altDate, lang)})` : ""}</h3>
          <table className="print-t"><tbody>{d.matches.filter((m) => m.roundId === r.id).map((m) => <tr key={m.id}><td className="l">{m.home.name}</td><td>{m.homeGoals != null ? <b>{m.homeGoals}–{m.awayGoals}</b> : m.time || "–"}</td><td className="l">{m.away.name}</td></tr>)}</tbody></table></div>
      ))}
      <footer className="print-f">{t.peu} · {new Date().toLocaleDateString("ca-ES")}</footer>
    </div>
  );
}
