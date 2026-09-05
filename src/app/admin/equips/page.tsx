import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupsAdmin, loadGroup } from "@/lib/stats";
import { db, schema } from "@/db";
import { count, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Equips() {
  await requireUser("content");
  const groups = getGroupsAdmin();
  const counts = new Map(db.select({ teamId: schema.players.teamId, n: count() }).from(schema.players).where(eq(schema.players.active, true)).groupBy(schema.players.teamId).all().map((r) => [r.teamId, r.n]));
  return (
    <>
      <h1>Equips i jugadors</h1>
      {groups.map((g) => (
        <div key={g.id} className="box">
          <h3 style={{ margin: "0 0 8px" }}>Grup {g.name}</h3>
          <ul className="rowlist">{loadGroup(g.id).teams.sort((a, b) => a.name.localeCompare(b.name, "ca")).map((t) => (
            <li key={t.id}>
              {t.logo ? <img className="thumb" src={`/uploads/${t.logo}`} alt="" style={{ width: 36, height: 36 }} /> : <span className="crest" />}
              <Link href={`/admin/equips/${t.id}`} style={{ fontWeight: 600, flex: 1 }}>{t.name}</Link>
              <span className="gk">{counts.get(t.id) ?? 0} jugadors{t.photo ? " · foto ✓" : " · sense foto"}</span>
              <Link className="btn ghost sm" href={`/admin/equips/${t.id}`}>Editar</Link>
            </li>
          ))}</ul>
        </div>
      ))}
    </>
  );
}
