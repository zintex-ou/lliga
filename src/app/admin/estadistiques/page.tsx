import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { desc, gte } from "drizzle-orm";
import { fmtDate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Estadistiques() {
  await requireUser("content");
  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const rows = db.select().from(schema.visits).where(gte(schema.visits.day, since)).all();
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const perDay = days.map((d) => ({ d, views: rows.filter((r) => r.day === d).reduce((a, r) => a + r.views, 0), visitors: rows.filter((r) => r.day === d).reduce((a, r) => a + r.visitors, 0) }));
  const max = Math.max(1, ...perDay.map((x) => x.views));
  const byPath = new Map<string, number>(); for (const r of rows) byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.views);
  const top = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  const teams = top.filter(([p]) => p.startsWith("/equip/"));
  const subs = db.select().from(schema.pushSubscriptions).orderBy(desc(schema.pushSubscriptions.id)).all();
  const total = perDay.reduce((a, x) => a + x.views, 0), totalV = perDay.reduce((a, x) => a + x.visitors, 0);
  return (
    <>
      <h1>Estadístiques de visites</h1>
      <div className="tiles">
        <div className="tile"><b>{total}</b><span>pàgines vistes (30 dies)</span></div>
        <div className="tile"><b>{totalV}</b><span>visitants (aprox., per dia)</span></div>
        <div className="tile"><b>{subs.length}</b><span>subscrits a notificacions · {subs.filter((s) => s.teamKey).length} per equip · {subs.filter((s) => s.groupName).length} per grup</span></div>
      </div>
      <h2>Per dia</h2>
      <div className="box"><div className="bars">{perDay.map((x) => <div key={x.d} className="bar" title={`${fmtDate(x.d, "ca")} · ${x.views} vistes · ${x.visitors} visitants`}><i style={{ height: `${Math.round((x.views / max) * 100)}%` }} /><span>{x.d.slice(8)}</span></div>)}{perDay.length === 0 && <p className="gk">Encara no hi ha dades.</p>}</div></div>
      <div className="acta-grid" style={{ marginTop: 14 }}>
        <div className="box"><h3 style={{ margin: "0 0 8px" }}>Pàgines més vistes</h3><table className="mini"><tbody>{top.map(([p, n]) => <tr key={p}><td>{p}</td><td className="c num"><b>{n}</b></td></tr>)}</tbody></table></div>
        <div className="box"><h3 style={{ margin: "0 0 8px" }}>Equips més consultats</h3><table className="mini"><tbody>{teams.map(([p, n]) => <tr key={p}><td>{p.replace("/equip/", "")}</td><td className="c num"><b>{n}</b></td></tr>)}{teams.length === 0 && <tr><td className="gk">—</td></tr>}</tbody></table></div>
      </div>
    </>
  );
}
