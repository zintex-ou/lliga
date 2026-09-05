import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupsAdmin, loadGroup, matchDate } from "@/lib/stats";
import { fmtDate } from "@/lib/i18n";
import { parseRound } from "@/lib/group";
import { publishMatches } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function Partits({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("content");
  const sp = await searchParams;
  const groups = getGroupsAdmin();
  const group = groups.find((g) => g.name === (sp.g || "A")?.toUpperCase()) ?? groups[0];
  const d = loadGroup(group.id, true);
  const round = parseRound(sp.j, d.nextRound, d.rounds.length);
  const matches = d.matches.filter((m) => m.round.number === round);
  const r = d.rounds.find((x) => x.number === round);
  const played = matches.filter((m) => (m.status === "played" || m.status === "walkover") && m.published);
  const base = process.env.SITE_URL || "";
  const waText = [`⚽ Resultats J${round} · Grup ${group.name}${r ? ` · ${fmtDate(r.date, "ca", false)}` : ""}`, ...played.map((m) => `${m.home.name} ${m.homeGoals}–${m.awayGoals} ${m.away.name}`), "", `Classificació i actes: ${base}/resultats/${group.name.toLowerCase()}?j=${round}`].join("\n");
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;
  return (
    <>
      <h1>Partits i actes</h1>
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="seg">{groups.map((g) => <Link key={g.id} className={g.id === group.id ? "on" : ""} href={`/admin/partits?g=${g.name}&j=${round}`}>Grup {g.name}</Link>)}</div>
        <div className="rnd" style={{ marginLeft: 0 }}>
          {round > 1 ? <Link href={`/admin/partits?g=${group.name}&j=${round - 1}`}>‹</Link> : <span className="dis">‹</span>}
          <span className="lab">Jornada {round}<small>{r ? fmtDate(r.date, "ca") : ""}</small></span>
          {round < d.rounds.length ? <Link href={`/admin/partits?g=${group.name}&j=${round + 1}`}>›</Link> : <span className="dis">›</span>}
        </div>
        <select defaultValue={round} name="j" form="jump" style={{ width: 120 }}>{d.rounds.map((x) => <option key={x.id} value={x.number}>J{x.number} · {fmtDate(x.date, "ca", false)}</option>)}</select>
        <form id="jump" action="/admin/partits"><input type="hidden" name="g" value={group.name} /><button className="btn ghost sm">Anar</button></form>
        <Link className="btn ghost sm" href={`/admin/calendari?g=${group.name}&j=${round}`}>Horaris i camps d'aquesta jornada</Link>
        {matches.some((m) => !m.published && (m.status === "played" || m.status === "walkover")) && <form action={publishMatches} style={{ display: "inline" }}>{matches.filter((m) => !m.published).map((m) => <input key={m.id} type="hidden" name="matchId" value={m.id} />)}<button className="btn sm">🔔 Publicar la jornada</button></form>}
        {played.length > 0 && <a className="btn sm" href={waHref} target="_blank" rel="noopener" style={{ background: "#25D366" }}>Compartir resultats per WhatsApp</a>}
      </div>
      <div className="box">
        <table className="mini">
          <thead><tr><th>Data</th><th>Hora</th><th>Local</th><th className="c">Resultat</th><th>Visitant</th><th>Camp</th><th>Estat</th><th></th></tr></thead>
          <tbody>{matches.map((m) => (
            <tr key={m.id}>
              <td>{fmtDate(matchDate(m), "ca", false)}</td><td>{m.time || "—"}</td>
              <td><b>{m.home.name}</b></td>
              <td className="c pts num">{m.homeGoals != null ? `${m.homeGoals}–${m.awayGoals}` : "–"}</td>
              <td><b>{m.away.name}</b></td>
              <td className="gk">{m.field || m.home.field || "—"}</td>
              <td><span className={`status-pill ${m.status}`}>{{ played: "Jugat", scheduled: "Pendent", postponed: "Ajornat", walkover: "No presentat" }[m.status]}</span>{!m.published && (m.status === "played" || m.status === "walkover") && <> <span className="status-pill walkover">Esborrany</span></>}</td>
              <td><Link className="btn sm" href={`/admin/partits/${m.id}`}>{m.status === "played" ? "Editar acta" : "Acta"}</Link></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
