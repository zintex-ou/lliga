import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { resolveReport } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function Avisos() {
  await requireUser("content");
  const list = db.select().from(schema.reports).orderBy(desc(schema.reports.id)).all();
  const Row = ({ r }: { r: typeof list[number] }) => {
    const m = r.matchId ? db.select().from(schema.matches).where(eq(schema.matches.id, r.matchId)).get() : null;
    const home = m ? db.select().from(schema.teams).where(eq(schema.teams.id, m.homeId)).get() : null, away = m ? db.select().from(schema.teams).where(eq(schema.teams.id, m.awayId)).get() : null;
    return (
      <li style={{ display: "block" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="gk">{r.createdAt.replace("T", " ").slice(0, 16)}</span>
          {m && <Link href={`/admin/partits/${m.id}`}><b>{home?.name} {m.homeGoals ?? "–"}–{m.awayGoals ?? "–"} {away?.name}</b></Link>}
          {r.contact && <span className="gk">· {r.contact}</span>}
          <form action={resolveReport} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={r.id} />{r.resolved && <input type="hidden" name="reopen" value="1" />}<button className={"btn sm " + (r.resolved ? "ghost" : "")}>{r.resolved ? "Reobrir" : "Resolt ✓"}</button></form>
        </div>
        <p style={{ margin: "4px 0 0", whiteSpace: "pre-line" }}>{r.message}</p>
      </li>
    );
  };
  return (
    <>
      <h1>Avisos d&apos;errors</h1>
      <h2 style={{ marginTop: 0 }}>Pendents ({list.filter((r) => !r.resolved).length})</h2>
      <div className="box"><ul className="rowlist">{list.filter((r) => !r.resolved).map((r) => <Row key={r.id} r={r} />)}{list.filter((r) => !r.resolved).length === 0 && <li className="gk">Cap avís pendent.</li>}</ul></div>
      <h2>Resolts</h2>
      <div className="box"><ul className="rowlist">{list.filter((r) => r.resolved).slice(0, 50).map((r) => <Row key={r.id} r={r} />)}{list.filter((r) => r.resolved).length === 0 && <li className="gk">—</li>}</ul></div>
    </>
  );
}
