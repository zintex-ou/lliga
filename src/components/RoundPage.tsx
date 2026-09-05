import { getT } from "@/lib/i18n";
import { getGroups, loadGroup } from "@/lib/stats";
import { resolveGroup, parseRound } from "@/lib/group";
import { FixtureList, GroupSeg, RoundNav, PendingMatches } from "@/components/public";

export async function RoundPage({ kind, g, j }: { kind: "calendari" | "resultats"; g?: string[]; j?: string }) {
  const { lang, t } = await getT();
  const group = await resolveGroup(g);
  const groups = getGroups();
  const data = loadGroup(group.id);
  const max = data.rounds.length;
  const def = kind === "calendari" ? data.nextRound : Math.max(1, data.lastPlayedRound);
  const round = parseRound(j, def, max);
  const matches = data.matches.filter((m) => m.round.number === round);
  const gl = group.name.toLowerCase();
  return (<>
    <div className="panel">
      <div className="panel-h">
        <h1>{kind === "calendari" ? t.calendari : t.resultats} · {t.grup} {group.name}</h1>
        <GroupSeg groups={groups} current={group.name} href={(x) => `/${kind}/${x}`} t={t} />
        <RoundNav round={round} date={data.rounds.find((r) => r.number === round)?.date} min={1} max={max} href={(r) => `/${kind}/${gl}?j=${r}`} t={t} lang={lang} />
      </div>
      <div className="panel-b"><FixtureList matches={matches} t={t} lang={lang} /></div>
      <div className="legend"><span>{kind === "calendari" ? t.calNote : t.resNote}</span>
        {kind === "calendari" && <span style={{ marginLeft: "auto" }}><a href={`webcal://HOST/ical/grup/${gl}.ics`} data-webcal>{t.subscriuCalendari} ({t.grup} {group.name})</a></span>}
        <a className="btn sm ghost" href={`/imprimir/jornada?g=${gl}&j=${round}`}>{t.pdf} J{round}</a>{kind === "calendari" && <a className="btn sm ghost" href={`/imprimir/calendari?g=${gl}`}>{t.pdf} {t.calendari}</a>}</div>
    </div>
    {kind === "calendari" && <PendingMatches matches={data.matches} t={t} lang={lang} />}
  </>);
}
