import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupsAdmin, groupPlayerStats, playerLabel, loadGroup } from "@/lib/stats";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { saveSanction, deleteSanction } from "@/lib/actions";

export const dynamic = "force-dynamic";
const REASONS: [string, string][] = [["comite", "Decisió del comitè"], ["falta_joc", "Falta de joc"], ["joc_violent", "Joc violent"], ["antiesportiva", "Conducta antiesportiva"], ["agressio", "Agressió / baralla"]];

export default async function SancionsAdmin() {
  await requireUser("content");
  const groups = getGroupsAdmin();
  const all = groups.flatMap((g) => groupPlayerStats(g.id).map((s) => ({ ...s, group: g })));
  const active = all.filter((s) => s.remaining > 0);
  const stored = db.select().from(schema.sanctions).orderBy(desc(schema.sanctions.id)).all();
  const pl = new Map(all.map((s) => [s.player.id, s]));
  return (
    <>
      <h1>Sancions</h1>
      <h2 style={{ marginTop: 0 }}>Sancionats vigents ({active.length})</h2>
      <div className="box"><table className="mini"><thead><tr><th>Jugador</th><th>Equip</th><th>Motiu</th><th className="c">Partits</th><th className="c">Complerts</th><th className="c">Queden</th></tr></thead>
        <tbody>{active.map((s) => <tr key={s.player.id}><td><Link href={`/admin/jugadors/${s.player.id}`}>{playerLabel(s.player)}</Link></td><td>{s.team.name} (Grup {s.group.name})</td><td>{s.activeSanction!.reason}{s.activeSanction!.startRound ? ` · J${s.activeSanction!.startRound}` : ""}</td><td className="c num">{s.activeSanction!.matches}</td><td className="c num">{s.activeSanction!.served}</td><td className="c pts num">{s.remaining}</td></tr>)}
        {active.length === 0 && <tr><td colSpan={6} className="gk">Cap jugador sancionat.</td></tr>}</tbody></table></div>

      <h2>Afegir sanció manual (comitè)</h2>
      <form action={saveSanction} className="box">
        <div className="form">
          <div><label>Jugador</label><select name="playerId" required>{groups.map((g) => <optgroup key={g.id} label={`Grup ${g.name}`}>{loadGroup(g.id).teams.sort((a, b) => a.name.localeCompare(b.name)).flatMap((t) => all.filter((s) => s.team.id === t.id).sort((a, b) => a.player.surname.localeCompare(b.player.surname)).map((s) => <option key={s.player.id} value={s.player.id}>{t.name} — {playerLabel(s.player)}</option>))}</optgroup>)}</select></div>
          <div><label>A partir de la jornada (inclosa)</label><input type="number" name="roundNumber" min={1} max={34} required /></div>
          <div><label>Partits de sanció</label><input type="number" name="matches" min={1} defaultValue={1} /></div>
          <div><label>Motiu</label><select name="reason">{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="full"><label>Notes (es mostren públicament)</label><input name="notes" /></div>
        </div>
        <div className="actions"><button className="btn">Afegir sanció</button></div>
      </form>

      <h2>Totes les sancions registrades</h2>
      <div className="box"><table className="mini"><thead><tr><th>Jugador</th><th>Origen</th><th>Motiu</th><th className="c">Partits</th><th>Complerts (manual)</th><th>Notes</th><th></th></tr></thead>
        <tbody>{stored.map((s) => { const st = pl.get(s.playerId); return (
          <tr key={s.id}>
            <td>{st ? <Link href={`/admin/jugadors/${s.playerId}`}>{playerLabel(st.player)}</Link> : `#${s.playerId}`}<div className="gk">{st?.team.name}</div></td>
            <td className="gk">{s.eventId ? `Targeta · partit #${s.matchId}` : `Manual · J${s.roundNumber}`}</td>
            <td>
              <form action={saveSanction} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="playerId" value={s.playerId} /><input type="hidden" name="roundNumber" value={s.roundNumber ?? ""} />
                <select name="reason" defaultValue={s.reason} style={{ width: 170 }}>{[...REASONS, ["acumulacio", "Acumulació"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <input type="number" name="matches" defaultValue={s.matches} min={0} className="w4" />
                <input type="number" name="servedOverride" defaultValue={s.servedOverride ?? ""} placeholder="auto" className="w4" title="Deixa buit per calcular automàticament" />
                <input name="notes" defaultValue={s.notes ?? ""} style={{ width: 160 }} />
                <button className="btn sm">Desar</button>
              </form>
            </td>
            <td className="c num">{s.matches}</td><td className="gk">{s.servedOverride ?? "auto"}</td><td className="gk">{s.notes}</td>
            <td><form action={deleteSanction}><input type="hidden" name="id" value={s.id} /><button className="btn ghost sm">×</button></form></td>
          </tr>); })}
        {stored.length === 0 && <tr><td colSpan={7} className="gk">—</td></tr>}</tbody></table>
        <p className="gk">Les sancions per acumulació de grogues es calculen soles i no apareixen aquí. Les de targeta vermella es creen des de l'acta; aquí es poden corregir partits, motiu i partits complerts.</p>
      </div>
    </>
  );
}
