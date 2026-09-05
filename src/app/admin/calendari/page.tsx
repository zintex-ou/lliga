import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupsAdmin, loadGroup, matchDate } from "@/lib/stats";
import { fmtDate } from "@/lib/i18n";
import { parseRound } from "@/lib/group";
import { saveSchedule } from "@/lib/actions";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function CalendariAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("content");
  const sp = await searchParams;
  const groups = getGroupsAdmin();
  const group = groups.find((g) => g.name === (sp.g || "A").toUpperCase()) ?? groups[0];
  const d = loadGroup(group.id, true);
  const round = parseRound(sp.j, d.nextRound, d.rounds.length);
  const matches = d.matches.filter((m) => m.round.number === round);
  const r = d.rounds.find((x) => x.number === round)!;
  const fields = [...new Set([...getGroupsAdmin().flatMap((g) => loadGroup(g.id, true).teams.map((t) => t.field)), ...getGroupsAdmin().flatMap((g) => loadGroup(g.id, true).matches.map((m) => m.field))].filter(Boolean) as string[])].sort();
  const refs = db.select().from(schema.referees).where(eq(schema.referees.active, true)).all().sort((a, b) => a.name.localeCompare(b.name));
  const times = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];
  return (
    <>
      <h1>Calendari i horaris</h1>
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="seg">{groups.map((g) => <Link key={g.id} className={g.id === group.id ? "on" : ""} href={`/admin/calendari?g=${g.name}&j=${round}`}>Grup {g.name}</Link>)}</div>
        <div className="rnd" style={{ marginLeft: 0 }}>
          {round > 1 ? <Link href={`/admin/calendari?g=${group.name}&j=${round - 1}`}>‹</Link> : <span className="dis">‹</span>}
          <span className="lab">Jornada {round}<small>{fmtDate(r.date, "ca")}</small></span>
          {round < d.rounds.length ? <Link href={`/admin/calendari?g=${group.name}&j=${round + 1}`}>›</Link> : <span className="dis">›</span>}
        </div>
      </div>
      <form action={saveSchedule} className="box">
        <table className="mini">
          <thead><tr><th>Local</th><th>Visitant</th><th>Data</th><th>Hora</th><th>Camp</th><th>Àrbitre</th><th>Estat</th></tr></thead>
          <tbody>{matches.map((m) => (
            <tr key={m.id}>
              <td><input type="hidden" name="matchId" value={m.id} /><b>{m.home.name}</b></td><td><b>{m.away.name}</b></td>
              <td><input type="date" name={`date_${m.id}`} defaultValue={matchDate(m)} style={{ width: 150 }} /></td>
              <td><input name={`time_${m.id}`} list="times" defaultValue={m.time ?? ""} placeholder="hh:mm" pattern="[0-2][0-9]:[0-5][0-9]" style={{ width: 90 }} /></td>
              <td><input name={`field_${m.id}`} list="fields" defaultValue={m.field ?? ""} placeholder={m.home.field ?? "camp de l'equip local"} /></td>
              <td><select name={`ref_${m.id}`} defaultValue={m.refereeId ?? ""} style={{ width: 160 }}><option value="">—</option>{refs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
              <td>{m.status === "played" || m.status === "walkover" ? <span className={`status-pill ${m.status}`}>{m.status === "played" ? "Jugat" : "No presentat"}</span> : (
                <select name={`status_${m.id}`} defaultValue={m.status} style={{ width: 120 }}><option value="scheduled">Pendent</option><option value="postponed">Ajornat</option></select>)}</td>
            </tr>
          ))}</tbody>
        </table>
        <datalist id="times">{times.map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="fields">{fields.map((x) => <option key={x} value={x} />)}</datalist>
        <div className="actions"><button className="btn">Desar horaris i àrbitres</button><span className="gk">Si el camp és buit s'utilitza el camp de l'equip local (fitxa de l'equip). Àrbitres: <Link href="/admin/arbitres">gestionar la llista</Link>.</span></div>
      </form>
    </>
  );
}
