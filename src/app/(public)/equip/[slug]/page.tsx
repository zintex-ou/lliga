import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { getT, fmtDob } from "@/lib/i18n";
import { getGroups, getSeason, loadGroup, teamPlayerStats, playerLabel, matchDate } from "@/lib/stats";
import { Crest, FixtureList, MapLink } from "@/components/public";
import { PlayerCard } from "@/components/PlayerCard";
import { teamSummary } from "@/lib/records";
import { PushToggle } from "@/components/PushToggle";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).get();
  if (!team) return {};
  const desc = [team.town, team.field].filter(Boolean).join(" · ") || "Futbol Empreses Girona";
  return { title: team.name, description: desc, openGraph: { title: team.name, description: desc, images: [{ url: `/og/equip/${team.slug}`, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image" } };
}

export default async function TeamPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params; const sp = await searchParams; const cards = sp.v !== "taula";
  const { lang, t } = await getT();
  const team = db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).get();
  if (!team) notFound();
  const group = getGroups().find((g) => g.id === team.groupId)!;
  const season = getSeason();
  const staff = db.select().from(schema.staff).where(eq(schema.staff.teamId, team.id)).orderBy(asc(schema.staff.sort)).all();
  const stats = teamPlayerStats(team).filter((s) => s.player.active || s.pj > 0);
  const order = { POR: 0, DEF: 1, MIG: 2, DAV: 3 } as Record<string, number>;
  stats.sort((a, b) => (order[a.player.position] ?? 9) - (order[b.player.position] ?? 9) || (a.player.dorsal ?? 999) - (b.player.dorsal ?? 999));
  const data = loadGroup(group.id);
  const mine = data.matches.filter((m) => m.homeId === team.id || m.awayId === team.id);
  const byDate = (a: typeof mine[number], b: typeof mine[number]) => matchDate(a).localeCompare(matchDate(b));
  const played = mine.filter((m) => m.status === "played" || m.status === "walkover").sort(byDate).slice(-5);
  const upcoming = mine.filter((m) => m.status === "scheduled" || m.status === "postponed").sort(byDate).slice(0, 3);
  const sum = teamSummary(team);
  const rec = (r: { w: number; d: number; l: number }) => `${r.w}-${r.d}-${r.l}`;
  const streakLabel = sum.streak.kind === "W" ? t.ratxaW : sum.streak.kind === "L" ? t.ratxaL : sum.streak.kind === "U" ? t.ratxaU : "";

  return (
    <>
      <div className="panel">
        <div className="team-hero">
          <Crest team={team} lg />
          <div>
            <h1>{team.name}</h1>
            <dl className="kv">
              <dt>{t.grup}</dt><dd><Link href={`/lliga/${group.name.toLowerCase()}`}>{group.name}</Link></dd>
              {team.town && <><dt>{t.poblacio}</dt><dd>{team.town}</dd></>}
              {team.field && <><dt>{t.camp}</dt><dd><MapLink field={team.field} town={team.town} hint={team.info} /></dd></>}
              {team.colors && <><dt>{t.colors}</dt><dd>{team.colors}</dd></>}
              {team.founded && <><dt>{t.aLaLligaDes}</dt><dd>{team.founded}</dd></>}
            </dl>
          </div>
          <div className="team-photo">{team.photo ? <img src={`/uploads/${team.photo}`} alt={team.name} /> : <span>{t.siteName}</span>}</div>
        </div>
        <div className="staff" style={{ paddingBottom: 0 }}>
          <a className="btn sm ghost" href={`webcal://HOST/ical/equip/${team.slug}.ics`} data-webcal>{t.subscriuCalendari}</a>
          <a className="btn sm ghost" href={`/ical/equip/${team.slug}.ics`} download>{t.descarregarIcs}</a>
          <Link className="btn sm ghost" href={`/equip/${team.slug}/galeria`}>{t.galeria}</Link>
          <PushToggle team={team.name} labelOn={t.pushOn} labelOff={t.pushOff} unsupported={t.pushUnsupported} lang={lang} />
        </div>
        {staff.length > 0 && (
          <div className="staff">{staff.map((s) => (
            <div key={s.id}><b>{s.name}</b>{t[s.role as "delegat"] ?? s.role}{s.phoneVisible && s.phone ? <> · <a href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a></> : ""}{s.phoneVisible && s.email ? <><br /><a href={`mailto:${s.email}`}>{s.email}</a></> : ""}</div>
          ))}</div>
        )}
        {team.info && <div className="info">{team.info}</div>}
        {sum.seq.length > 0 && (
          <div className="tsum">
            <div className="stat"><b><span className="form-dots" style={{ gap: 5 }}>{sum.seq.slice(-5).map((x, i) => <i key={i} className={x.r} style={{ width: 14, height: 14 }} />)}</span></b><span>{t.forma5}</span></div>
            <div className="stat"><b className={`streak-${sum.streak.kind}`}>{sum.streak.n}</b><span>{streakLabel}</span></div>
            <div className="stat"><b className="small">{rec(sum.all)}</b><span>{t.g}-{t.e}-{t.p} · {sum.all.gf}:{sum.all.ga}</span></div>
            <div className="stat"><b className="small">{rec(sum.home)}</b><span>{t.casa}</span></div>
            <div className="stat"><b className="small">{rec(sum.away)}</b><span>{t.fora}</span></div>
            <div className="stat"><b>{(sum.all.gf / sum.seq.length).toFixed(1)}</b><span>{t.golsPerPartit}</span></div>
            <div className="stat"><b>{sum.cleanSheets}</b><span>{t.porteriaZero}</span></div>
            {sum.bestWin && <div className="stat"><b className="small">{sum.bestWin.gf}–{sum.bestWin.ga}</b><span>{t.millorVictoria} · {sum.bestWin.home ? sum.bestWin.m.away.name : sum.bestWin.m.home.name}</span></div>}
            {sum.worstLoss && <div className="stat"><b className="small">{sum.worstLoss.gf}–{sum.worstLoss.ga}</b><span>{t.pitjorDerrota} · {sum.worstLoss.home ? sum.worstLoss.m.away.name : sum.worstLoss.m.home.name}</span></div>}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-h"><h2>{t.plantilla}</h2><span style={{ color: "var(--ink2)", fontSize: 13 }}>{stats.length} {t.jugadors}</span>
          <div className="seg" style={{ marginLeft: "auto" }}><Link className={cards ? "on" : ""} href={`/equip/${team.slug}`}>{t.cartes}</Link><Link className={cards ? "" : "on"} href={`/equip/${team.slug}?v=taula`}>{t.taula}</Link></div></div>
        {cards && <div className="fut-grid">{stats.map((s) => <PlayerCard key={s.player.id} s={s} team={team} t={t} size="sm" href={`/jugador/${s.player.id}`} assists={season.assistsEnabled} />)}</div>}
        {!cards && <div className="tbl-wrap"><table>
          <thead><tr>
            <th className="c">{t.dorsal}</th><th>{t.jugador}</th><th className="c">{t.pos}</th><th>{t.naixement}</th>
            <th className="c">{t.pj}</th><th className="c">{t.golsPen}</th>{season.assistsEnabled && <th className="c">{t.ass}</th>}
            <th className="c"><span className="card y" /></th><th className="c"><span className="card r" /></th><th className="c">{t.encaixats}</th>
          </tr></thead>
          <tbody>{stats.map((s) => {
            const gk = s.player.position === "POR";
            return (
              <tr key={s.player.id} style={s.player.active ? undefined : { opacity: .55 }}>
                <td className="c num">{s.player.dorsal ?? ""}</td>
                <td><Link className="plink" href={`/jugador/${s.player.id}`}>{playerLabel(s.player)}</Link>{s.remaining > 0 && <> <span className="tag susp">SANC {s.remaining}</span></>}{!s.player.active && <> <span className="tag">{t.baixa}</span></>}</td>
                <td className="c">{t[`${s.player.position}_s` as "POR_s"]}</td>
                <td className="num">{fmtDob(s.player.dob)}</td>
                <td className="c num">{s.pj}</td>
                <td className="c num">{s.goals}{s.pen ? ` (${s.pen})` : ""}</td>
                {season.assistsEnabled && <td className="c num">{s.assists}</td>}
                <td className="c num">{s.yellows || ""}</td><td className="c num">{s.reds || ""}</td>
                <td className="c num gk">{gk ? s.conceded : "—"}</td>
              </tr>
            );
          })}</tbody>
        </table></div>}
        <div className="legend"><span><span className="card y" /> {t.grogues}</span><span><span className="card r" /> {t.vermelles}</span><span><span className="tag susp">SANC n</span> {t.sancionat} — {t.queden.toLowerCase()} n {t.partits.toLowerCase()}</span><span>{t.golsPen}</span></div>
      </div>

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="panel"><div className="panel-h"><h2>{t.resultats}</h2></div><div className="panel-b"><FixtureList matches={played} t={t} lang={lang} showDate /></div></div>
        <div className="panel"><div className="panel-h"><h2>{t.calendari}</h2></div><div className="panel-b"><FixtureList matches={upcoming} t={t} lang={lang} /></div></div>
      </div>
    </>
  );
}
