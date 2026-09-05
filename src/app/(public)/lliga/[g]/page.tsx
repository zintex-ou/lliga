import { getT } from "@/lib/i18n";
import { getGroups, loadGroup, standings } from "@/lib/stats";
import { resolveGroup, parseRound } from "@/lib/group";
import { GroupSeg, RoundNav, Standings, ZoneLegend, QuickLinks } from "@/components/public";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LligaPage({ params, searchParams }: { params: Promise<{ g: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { g } = await params; const sp = await searchParams;
  const { lang, t } = await getT();
  const group = await resolveGroup(g);
  const groups = getGroups();
  const user = await getUser();
  const data = loadGroup(group.id);
  const round = parseRound(sp.j, data.lastPlayedRound, Math.max(1, data.lastPlayedRound));
  const rows = standings(group.id, round || undefined);
  const prevRows = round > 1 ? standings(group.id, round - 1) : undefined;
  const gl = group.name.toLowerCase();
  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <h1>{t.classificacio} · {t.grup} {group.name}</h1>
          <GroupSeg groups={groups} current={group.name} href={(x) => `/lliga/${x}`} t={t} />
          <RoundNav round={round} date={data.rounds.find((r) => r.number === round)?.date} min={1} max={data.lastPlayedRound} href={(r) => `/lliga/${gl}?j=${r}`} t={t} lang={lang} />
        </div>
        <Standings rows={rows} group={group} t={t} highlightTeamId={user?.teamId} prevRows={prevRows} />
        <div className="legend"><ZoneLegend group={group} t={t} /><span style={{ marginLeft: "auto" }}>{t.clickTeam}</span><a className="btn sm ghost" href={`/imprimir/classificacio?g=${gl}`}>{t.pdf} ↗</a></div>
      </div>
      <QuickLinks t={t} g={gl} />
    </>
  );
}
