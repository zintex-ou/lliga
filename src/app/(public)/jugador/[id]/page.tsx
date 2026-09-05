import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { getT, fmtDob, fmtDate, age } from "@/lib/i18n";
import { getSeason, loadGroup, matchDate, teamPlayerStats, playerName, playerSanctions } from "@/lib/stats";
import { PlayerCard } from "@/components/PlayerCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = db.select().from(schema.players).where(eq(schema.players.id, Number(id))).get();
  if (!player) return {};
  const team = db.select().from(schema.teams).where(eq(schema.teams.id, player.teamId)).get();
  const title = playerName(player);
  return { title, description: team?.name, openGraph: { title, description: team?.name, images: [{ url: `/og/jugador/${player.id}`, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image" } };
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang, t } = await getT();
  const player = db.select().from(schema.players).where(eq(schema.players.id, Number(id))).get();
  if (!player) notFound();
  const team = db.select().from(schema.teams).where(eq(schema.teams.id, player.teamId)).get()!;
  const season = getSeason();
  const st = teamPlayerStats(team).find((s) => s.player.id === player.id)!;
  const sanctions = playerSanctions(team, player.id);
  const gk = player.position === "POR";
  const a = age(player.dob);

  // match history
  const apps = db.select().from(schema.appearances).where(eq(schema.appearances.playerId, player.id)).all();
  const evs = db.select().from(schema.events).where(eq(schema.events.playerId, player.id)).all();
  const assisted = db.select().from(schema.events).where(eq(schema.events.assistId, player.id)).all();
  const mids = [...new Set([...apps.map((x) => x.matchId), ...evs.map((x) => x.matchId), ...assisted.map((x) => x.matchId)])];
  const { matches } = loadGroup(team.groupId);
  const hist = matches.filter((m) => mids.includes(m.id));
  void inArray;

  const reasonLabel = (r: string) => (t[r as keyof typeof t] as string) || r;

  return (
    <>
      <div className="panel pcard">
        <div><PlayerCard s={st} team={team} t={t} assists={season.assistsEnabled} /></div>
        <div>
          <Link href={`/equip/${team.slug}`} style={{ fontSize: 13 }}>← {team.name}</Link>
          <h1>{playerName(player)} {st.remaining > 0 && <span className="tag susp">{t.sancionat} · {st.remaining === 1 ? t.quedaPartit : t.quedenPartits.replace("{n}", String(st.remaining))}</span>}{!player.active && <span className="tag">{t.baixa}</span>}</h1>
          <div className="sub">{t[player.position as "POR"]}{player.dorsal != null ? ` · ${t.dorsal} ${player.dorsal}` : ""}{player.dob ? ` · ${fmtDob(player.dob)} (${a} ${t.anys})` : ""}</div>
          <div className="stats">
            <div className="stat"><b>{st.pj}</b><span>{t.partits}</span></div>
            {gk && <div className="stat"><b>{st.conceded}</b><span>{t.golsEncaixats}</span></div>}
            <div className="stat"><b>{st.goals}{st.pen ? <small> ({st.pen})</small> : null}</b><span>{t.golsPen}</span></div>
            {season.assistsEnabled && <div className="stat"><b>{st.assists}</b><span>{t.assistents}</span></div>}
            <div className="stat"><b>{st.yellows} <span className="card y" /></b><span>{t.grogues}</span></div>
            <div className={"stat" + (st.reds ? " warn" : "")}><b>{st.reds} <span className="card r" /></b><span>{t.vermelles}</span></div>
          </div>
          {sanctions.length > 0 && (
            <div className="hist">
              <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{t.historialSancions}</h3>
              <table><thead><tr><th>{t.motiu}</th><th className="c">{t.jornada}</th><th className="c">{t.partits}</th><th className="c">{t.queden}</th></tr></thead>
                <tbody>{sanctions.map((s, i) => (
                  <tr key={i}><td>{reasonLabel(s.reason)}{s.notes ? ` — ${s.notes}` : ""}</td><td className="c">{s.startRound ? `J${s.startRound}` : "—"}</td><td className="c num">{s.matches}</td><td className="c num">{s.remaining > 0 ? <b style={{ color: "var(--red)" }}>{s.remaining}</b> : 0}</td></tr>
                ))}</tbody></table>
            </div>
          )}
          <div className="hist">
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{t.partits}</h3>
            <table>
              <thead><tr><th>{t.jornada}</th><th>{t.partit}</th><th className="c">{t.gols}</th>{season.assistsEnabled && <th className="c">{t.ass}</th>}<th className="c">{t.targetes}</th>{gk && <th className="c">{t.encaixats}</th>}</tr></thead>
              <tbody>
                {hist.length === 0 && <tr><td colSpan={6} className="empty">—</td></tr>}
                {hist.map((m) => {
                  const e = evs.filter((x) => x.matchId === m.id);
                  const g = e.filter((x) => x.type === "gol" || x.type === "gol_pen").length, p = e.filter((x) => x.type === "gol_pen").length;
                  const as = assisted.filter((x) => x.matchId === m.id).length;
                  const ap = apps.find((x) => x.matchId === m.id);
                  return (
                    <tr key={m.id}>
                      <td className="num">J{m.round.number} · {fmtDate(matchDate(m), lang, false)}</td>
                      <td><Link href={`/partit/${m.id}`} style={{ color: "inherit" }}>{m.homeId === team.id ? <b>{m.home.name}</b> : m.home.name} {m.homeGoals}–{m.awayGoals} {m.awayId === team.id ? <b>{m.away.name}</b> : m.away.name}</Link>{ap && !ap.entered ? <span className="gk"> · {t.suplents.toLowerCase()}</span> : ""}</td>
                      <td className="c num">{g ? `${g}${p ? ` (${p})` : ""}` : ""}</td>
                      {season.assistsEnabled && <td className="c num">{as || ""}</td>}
                      <td className="c">{e.filter((x) => x.type === "groga" || x.type === "segona_groga").map((x, i) => <span key={i} className="card y" style={{ marginRight: 2 }} />)}{e.filter((x) => x.type === "vermella" || x.type === "segona_groga").map((x, i) => <span key={"r" + i} className="card r" />)}</td>
                      {gk && <td className="c num">{ap?.conceded ?? ""}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
