import Link from "next/link";
import { getT } from "@/lib/i18n";
import { getAllSeasons, getActiveSeason, standings } from "@/lib/stats";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { TeamLink } from "@/components/public";

export const dynamic = "force-dynamic";

export default async function Arxiu() {
  const { t } = await getT();
  const seasons = getAllSeasons();
  const active = getActiveSeason();
  return (
    <div className="panel">
      <div className="panel-h"><h1>{t.arxiu}</h1></div>
      <div className="panel-b">
        {seasons.map((s) => {
          const groups = db.select().from(schema.groups).where(eq(schema.groups.seasonId, s.id)).orderBy(asc(schema.groups.name)).all();
          return (
            <div key={s.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 24 }}>{t.temporada} {s.name}</h2>
                {s.id === active.id ? <span className="tag green">{t.actual}</span> : <span className="tag">{t.arxiu}</span>}
                <Link className="btn sm ghost" href={`/temporada/${s.id === active.id ? "actual" : s.id}?to=/`} style={{ marginLeft: "auto" }}>{t.veureTemporada} →</Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 8 }}>
                {groups.map((g) => {
                  const rows = standings(g.id).slice(0, 3);
                  return (
                    <div key={g.id} className="stat" style={{ textAlign: "left" }}>
                      <span>{t.grup} {g.name}</span>
                      <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>{rows.map((r) => <li key={r.team.id}><TeamLink team={r.team} plain /> <span className="gk">{r.pts} {t.pts.toLowerCase()}</span></li>)}</ol>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
