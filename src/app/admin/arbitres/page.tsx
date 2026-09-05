import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { asc, inArray } from "drizzle-orm";
import { saveReferee, deleteReferee } from "@/lib/actions";
import { getGroupsAdmin, loadGroup, matchDate } from "@/lib/stats";
import { fmtDate } from "@/lib/i18n";
import { Stars } from "@/components/Stars";

export const dynamic = "force-dynamic";

/** Referees: list, per-referee statistics (matches, cards) and upcoming assignments. Visible to admin and both presidents. */
export default async function Arbitres() {
  await requireUser("content");
  const refs = db.select().from(schema.referees).orderBy(asc(schema.referees.name)).all();
  const groups = getGroupsAdmin();
  const all = groups.flatMap((g) => loadGroup(g.id, true).matches.map((m) => ({ ...m, g })));
  const playedIds = all.filter((m) => m.status === "played").map((m) => m.id);
  const evs = playedIds.length ? db.select().from(schema.events).where(inArray(schema.events.matchId, playedIds)).all() : [];
  const ratings = db.select().from(schema.refereeRatings).all();
  const teamsAll = new Map(groups.flatMap((g) => loadGroup(g.id, true).teams).map((t) => [t.id, t.name]));
  const stats = refs.map((r) => {
    const ms = all.filter((m) => m.refereeId === r.id);
    const played = ms.filter((m) => m.status === "played");
    const e = evs.filter((x) => played.some((m) => m.id === x.matchId));
    const y = e.filter((x) => x.type === "groga" || x.type === "segona_groga").length, red = e.filter((x) => x.type === "vermella" || x.type === "segona_groga").length;
    const upcoming = ms.filter((m) => m.status === "scheduled").sort((a, b) => matchDate(a).localeCompare(matchDate(b))).slice(0, 3);
    const rr = ratings.filter((x) => x.refereeId === r.id);
    return { r, n: played.length, y, red, upcoming, perA: played.filter((m) => m.g.name === "A").length, perB: played.filter((m) => m.g.name === "B").length, avg: rr.length ? rr.reduce((a, x) => a + x.score, 0) / rr.length : null, rr };
  });
  return (
    <>
      <h1>Arbitratge</h1>
      <p className="gk">Assignació per jornada: <Link href="/admin/calendari">Calendari i horaris</Link> (columna Àrbitre). Aquesta pàgina és privada.</p>
      <div className="box"><table className="mini">
        <thead><tr><th>Àrbitre</th><th>Telèfon</th><th className="c">Partits</th><th className="c">Grup A / B</th><th className="c">🟨</th><th className="c">🟥</th><th className="c">🟨 / partit</th><th className="c">Valoració</th><th>Propers</th><th></th></tr></thead>
        <tbody>{stats.map(({ r, n, y, red, upcoming, perA, perB, avg, rr }) => (
          <tr key={r.id} style={r.active ? undefined : { opacity: .5 }}>
            <td><details className="edit"><summary>{r.name}{!r.active && " (inactiu)"}</summary>
              <form action={saveReferee} className="actions"><input type="hidden" name="id" value={r.id} /><input name="name" defaultValue={r.name} style={{ width: 200 }} /><input name="phone" defaultValue={r.phone ?? ""} placeholder="telèfon" style={{ width: 130 }} /><input name="notes" defaultValue={r.notes ?? ""} placeholder="notes" style={{ width: 180 }} /><label style={{ fontSize: 12 }}><input type="checkbox" name="active" defaultChecked={r.active} /> actiu</label><button className="btn sm">Desar</button></form>
              <form action={deleteReferee} style={{ marginTop: 6 }}><input type="hidden" name="id" value={r.id} /><button className="btn ghost sm">Esborrar</button></form></details></td>
            <td className="gk">{r.phone ?? ""}</td><td className="c num">{n}</td><td className="c num">{perA} / {perB}</td><td className="c num">{y}</td><td className="c num">{red}</td><td className="c num">{n ? (y / n).toFixed(1) : "—"}</td>
            <td className="c num">{avg != null ? <><Stars value={avg} size={15} /> <b>{avg.toFixed(1)}</b></> : "—"}{rr.length ? <span className="gk"> ({rr.length})</span> : null}{rr.some((x) => x.protest) && <details className="edit" style={{ margin: 0 }}><summary style={{ fontSize: 11, color: "var(--red)" }}>⚠ {rr.filter((x) => x.protest).length} protestes</summary><ul className="gk" style={{ textAlign: "left", paddingLeft: 14, margin: 4 }}>{rr.filter((x) => x.protest).map((x) => { const m = all.find((mm) => mm.id === x.matchId); return <li key={x.id}>{m ? `J${m.round.number} ${m.home.name}–${m.away.name}` : ""} · {teamsAll.get(x.teamId)} ({x.score}/5): {x.comment || "—"}</li>; })}</ul></details>}</td>
            <td className="gk">{upcoming.map((m) => `J${m.round.number} ${fmtDate(matchDate(m), "ca", false)} ${m.home.name}–${m.away.name}`).join(" · ") || "—"}</td>
            <td></td>
          </tr>
        ))}{refs.length === 0 && <tr><td colSpan={10} className="gk">Cap àrbitre encara.</td></tr>}</tbody>
      </table></div>
      <h2>Afegir àrbitre</h2>
      <form action={saveReferee} className="box actions" style={{ marginTop: 0 }}><input name="name" placeholder="Nom i cognoms" required style={{ width: 240 }} /><input name="phone" placeholder="telèfon" style={{ width: 140 }} /><input name="notes" placeholder="notes" style={{ width: 200 }} /><button className="btn">+ Afegir</button></form>
    </>
  );
}
