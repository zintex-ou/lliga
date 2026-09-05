import Link from "next/link";
import { getT } from "@/lib/i18n";
import { getGroups, getSeason, groupPlayerStats, playerLabel } from "@/lib/stats";
import { resolveGroup } from "@/lib/group";
import { GroupSeg, TeamLink } from "@/components/public";

export async function RankingsPage({ kind, g }: { kind: "gol" | "ass" | "disc"; g?: string[] }) {
  const { t } = await getT();
  const group = await resolveGroup(g);
  const groups = getGroups();
  const season = getSeason();
  const gl = group.name.toLowerCase();
  const all = groupPlayerStats(group.id);
  const base = kind === "disc" ? `/sancions/${gl}` : `/golejadors/${gl}`;

  const tabs = (
    <div className="seg">
      <Link className={kind === "gol" ? "on" : ""} href={`/golejadors/${gl}`}>{t.golejadors}</Link>
      {season.assistsEnabled && <Link className={kind === "ass" ? "on" : ""} href={`/golejadors/${gl}?t=ass`}>{t.assistents}</Link>}
      <Link className={kind === "disc" ? "on" : ""} href={`/sancions/${gl}`}>{t.sancions}</Link>
    </div>
  );

  if (kind === "disc") {
    const active = all.filter((s) => s.remaining > 0).sort((a, b) => b.remaining - a.remaining);
    const carded = all.filter((s) => s.yellows + s.reds > 0).sort((a, b) => b.reds - a.reds || b.yellows - a.yellows || a.player.surname.localeCompare(b.player.surname));
    return (
      <>
        <div className="panel">
          <div className="panel-h">{tabs}<GroupSeg groups={groups} current={group.name} href={(x) => `/sancions/${x}`} t={t} /></div>
          <div className="panel-h" style={{ borderTop: 0 }}><h2>{t.sancionatsVigents}</h2></div>
          {active.length === 0 ? <p className="empty">{t.capSancionat}</p> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th>{t.jugador}</th><th>{t.equip}</th><th>{t.motiu}</th><th className="c">{t.sancio}</th><th className="c">{t.queden}</th></tr></thead>
              <tbody>{active.map((s) => (
                <tr key={s.player.id}>
                  <td><Link className="plink" href={`/jugador/${s.player.id}`}>{playerLabel(s.player)}</Link> <span className="tag susp">SANC</span></td>
                  <td><TeamLink team={s.team} plain /></td>
                  <td>{t[s.activeSanction!.reason as keyof typeof t] as string}{s.activeSanction?.startRound ? ` · J${s.activeSanction.startRound}` : ""}</td>
                  <td className="c num">{s.activeSanction!.matches}</td>
                  <td className="c pts num">{s.remaining}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </div>
        <div className="panel">
          <div className="panel-h"><h2>{t.targetes}</h2></div>
          <div className="tbl-wrap"><table>
            <thead><tr><th></th><th>{t.jugador}</th><th>{t.equip}</th><th className="c">{t.pj}</th><th className="c"><span className="card y" /></th><th className="c"><span className="card r" /></th></tr></thead>
            <tbody>{carded.map((s, k) => (
              <tr key={s.player.id}><td className="pos num">{k + 1}</td>
                <td><Link className="plink" href={`/jugador/${s.player.id}`}>{playerLabel(s.player)}</Link></td>
                <td><TeamLink team={s.team} plain /></td><td className="c num">{s.pj}</td><td className="c num">{s.yellows || ""}</td><td className="c num">{s.reds || ""}</td></tr>))}
            {carded.length === 0 && <tr><td colSpan={6} className="empty">—</td></tr>}
            </tbody>
          </table></div>
        </div>
      </>
    );
  }

  const rows = (kind === "gol" ? all.filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals || a.pen - b.pen || a.pj - b.pj)
    : all.filter((s) => s.assists > 0).sort((a, b) => b.assists - a.assists || a.pj - b.pj)).slice(0, 60);
  return (
    <div className="panel">
      <div className="panel-h">{tabs}<GroupSeg groups={groups} current={group.name} href={(x) => `/golejadors/${x}${kind === "ass" ? "?t=ass" : ""}`} t={t} /></div>
      <div className="tbl-wrap"><table>
        <thead><tr><th></th><th>{t.jugador}</th><th>{t.equip}</th><th className="c">{t.pj}</th><th className="c">{kind === "gol" ? t.golsPen : t.ass}</th></tr></thead>
        <tbody>{rows.map((s, k) => (
          <tr key={s.player.id}><td className="pos num">{k + 1}</td>
            <td><Link className="plink" href={`/jugador/${s.player.id}`}>{playerLabel(s.player)}</Link></td>
            <td><TeamLink team={s.team} plain /></td><td className="c num">{s.pj}</td>
            <td className="c pts num">{kind === "gol" ? <>{s.goals}{s.pen ? <small style={{ fontWeight: 400, color: "var(--ink2)", fontSize: 13 }}> ({s.pen})</small> : null}</> : s.assists}</td></tr>))}
        {rows.length === 0 && <tr><td colSpan={5} className="empty">—</td></tr>}
        </tbody>
      </table></div>
      <div className="legend"><span>{base && ""}{kind === "gol" ? t.golsPen : t.ass}</span></div>
    </div>
  );
}
