import Link from "next/link";
import { getT, fmtDate } from "@/lib/i18n";
import { getGroups, loadGroup, standings } from "@/lib/stats";
import { resolveGroup, parseRound, showNextRound } from "@/lib/group";
import { FixtureList, GroupSeg, RoundNav, Standings, ZoneLegend, QuickLinks, PendingMatches, Birthdays } from "@/components/public";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { PushToggle } from "@/components/PushToggle";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { lang, t } = await getT();
  const groups = getGroups();
  const user = await getUser();
  let group = await resolveGroup(sp.g);
  if (!sp.g && user?.teamId) {
    const team = db.select().from(schema.teams).where(eq(schema.teams.id, user.teamId)).get();
    if (team) group = groups.find((g) => g.id === team.groupId) ?? group;
  }
  const gl = group.name.toLowerCase();
  const data = loadGroup(group.id);
  const maxRound = data.rounds.length;
  const nothingPlayed = data.lastPlayedRound === 0;
  const nextMode = showNextRound();

  // left column
  const defaultLeft = nothingPlayed || nextMode ? data.nextRound : data.lastPlayedRound;
  const leftRound = parseRound(sp.j, defaultLeft, maxRound);
  const leftRoundObj = data.rounds.find((r) => r.number === leftRound);
  const leftMatches = data.matches.filter((m) => m.round.number === leftRound);
  const leftPlayed = leftMatches.some((m) => m.status === "played");
  const leftTitle = leftPlayed ? t.resultats : leftRound === data.nextRound ? t.properaJornada : t.calendari;

  // right column: standings after round jt (or 2nd round calendar when nothing played)
  const tRound = parseRound(sp.jt, data.lastPlayedRound, Math.max(1, data.lastPlayedRound));
  const rows = standings(group.id, tRound || undefined);
  const prevRows = tRound > 1 ? standings(group.id, tRound - 1) : undefined;

  const posts = db.select().from(schema.posts).where(eq(schema.posts.published, true)).orderBy(desc(schema.posts.publishedAt), desc(schema.posts.id)).limit(4).all();
  const hrefG = (g: string) => `/grp/${g}?to=${encodeURIComponent(`/?g=${g}`)}`;

  return (
    <>
      <div className="grid2">
        <div className="panel">
          <div className="panel-h">
            <h2>{leftTitle}</h2>
            <GroupSeg groups={groups} current={group.name} href={hrefG} t={t} />
            <RoundNav round={leftRound} date={leftRoundObj?.date} min={1} max={maxRound} href={(r) => `/?g=${gl}&j=${r}${sp.jt ? `&jt=${sp.jt}` : ""}`} t={t} lang={lang} />
          </div>
          <div className="panel-b"><FixtureList matches={leftMatches} t={t} lang={lang} /></div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h2>{t.classificacio}</h2>
            <GroupSeg groups={groups} current={group.name} href={hrefG} t={t} />
            {data.lastPlayedRound > 0 && <RoundNav round={tRound} date={data.rounds.find((r) => r.number === tRound)?.date} min={1} max={data.lastPlayedRound} href={(r) => `/?g=${gl}&j=${leftRound}&jt=${r}`} t={t} lang={lang} />}
          </div>
          <Standings rows={rows} group={group} t={t} compact highlightTeamId={user?.teamId} prevRows={prevRows} />
          <div className="legend"><ZoneLegend group={group} t={t} /><Link href={`/lliga/${gl}`} style={{ marginLeft: "auto" }}>{t.classificacio} →</Link></div>
        </div>
      </div>

      <div className="actions" style={{ marginTop: 14, justifyContent: "flex-end" }}><span className="gk">{t.pushHint}</span><PushToggle group={group.name} labelOn={`${t.pushOn} · ${t.grup} ${group.name}`} labelOff={`${t.pushOffGroup} ${group.name}`} unsupported={t.pushUnsupported} lang={lang} /></div>
      <PendingMatches matches={data.matches} t={t} lang={lang} />
      <Birthdays groupId={group.id} t={t} lang={lang} />
      <QuickLinks t={t} g={gl} />

      <div className="panel news">
        <div className="panel-h"><h2>{t.comunicats}</h2><Link href="/normatives/circulars" style={{ marginLeft: "auto", fontSize: 13 }}>{t.totsElsComunicats} →</Link></div>
        <div className="panel-b">
          {posts.length === 0 && <p className="empty">—</p>}
          {posts.map((p) => (
            <article key={p.id}>
              <time>{fmtDate(p.publishedAt.slice(0, 10), lang)}</time>
              <div><h3>{p.title}</h3><p>{p.body.length > 320 ? p.body.slice(0, 320) + "…" : p.body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
