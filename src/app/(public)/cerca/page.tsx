import Link from "next/link";
import { getT, fmtDob } from "@/lib/i18n";
import { getGroups, loadGroup, teamPlayerStats, playerLabel } from "@/lib/stats";
import { TeamLink } from "@/components/public";

export const dynamic = "force-dynamic";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function Cerca({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const q = (sp.q ?? "").trim();
  const words = norm(q).split(/\s+/).filter(Boolean);
  const results = words.length < 1 || q.length < 2 ? [] : getGroups().flatMap((g) => loadGroup(g.id).teams.flatMap((team) => teamPlayerStats(team).filter((s) => { const hay = norm(`${s.player.surname} ${s.player.name}`); return words.every((w) => hay.includes(w)); }).map((s) => ({ s, team, g })))).slice(0, 100);
  return (
    <div className="panel">
      <div className="panel-h"><h1>{t.cerca}</h1>
        <form action="/cerca" className="search"><input name="q" defaultValue={q} placeholder={t.cercaPh} autoFocus /><button className="btn sm">→</button></form></div>
      {q && (results.length === 0 ? <p className="empty">{t.capResultatCerca}</p> : (
        <div className="tbl-wrap"><table>
          <thead><tr><th>{t.jugador}</th><th>{t.equip}</th><th className="c">{t.grup}</th><th className="c">{t.pos}</th><th>{t.naixement}</th><th className="c">{t.pj}</th><th className="c">{t.gols}</th><th className="c"><span className="card y" /></th><th className="c"><span className="card r" /></th></tr></thead>
          <tbody>{results.map(({ s, team, g }) => (
            <tr key={s.player.id}><td><Link className="plink" href={`/jugador/${s.player.id}`}>{playerLabel(s.player)}</Link>{s.remaining > 0 && <> <span className="tag susp">SANC {s.remaining}</span></>}{!s.player.active && <> <span className="tag">{t.baixa}</span></>}</td>
              <td><TeamLink team={team} /></td><td className="c">{g.name}</td><td className="c">{t[`${s.player.position}_s` as "POR_s"]}</td><td className="num">{fmtDob(s.player.dob)}</td>
              <td className="c num">{s.pj}</td><td className="c num">{s.goals}</td><td className="c num">{s.yellows || ""}</td><td className="c num">{s.reds || ""}</td></tr>
          ))}</tbody>
        </table></div>
      ))}
    </div>
  );
}
