import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, canEditMatches } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { saveTeam, saveStaff, deleteStaff, savePlayer, deletePlayer, importPlayers, addTeamPhoto, deleteTeamPhoto } from "@/lib/actions";
import { getActiveSeason, teamKey } from "@/lib/stats";
import { fmtDob } from "@/lib/i18n";
import { teamPlayerStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
const POS = ["POR", "DEF", "MIG", "DAV"];

export default async function TeamAdmin({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const team = db.select().from(schema.teams).where(eq(schema.teams.id, Number(id))).get();
  if (!team) notFound();
  const full = canEditMatches(user.role);
  if (!full && !(user.role === "delegat" && user.teamId === team.id)) redirect("/admin");
  const staff = db.select().from(schema.staff).where(eq(schema.staff.teamId, team.id)).orderBy(asc(schema.staff.sort)).all();
  const gallery = db.select().from(schema.teamPhotos).where(eq(schema.teamPhotos.teamKey, teamKey(team.name))).all().sort((a, b) => b.season.localeCompare(a.season) || a.id - b.id);
  const seasonName = getActiveSeason().name;
  const stats = teamPlayerStats(team);
  const order = { POR: 0, DEF: 1, MIG: 2, DAV: 3 } as Record<string, number>;
  stats.sort((a, b) => Number(b.player.active) - Number(a.player.active) || (order[a.player.position] ?? 9) - (order[b.player.position] ?? 9) || (a.player.dorsal ?? 999) - (b.player.dorsal ?? 999));

  return (
    <>
      <div className="actions" style={{ marginTop: 0 }}>{full && <Link href="/admin/equips">← Equips</Link>}<Link href={`/equip/${team.slug}`} target="_blank" style={{ marginLeft: "auto" }}>Veure pàgina pública ↗</Link></div>
      <h1>{team.name}</h1>

      <form action={saveTeam} className="box">
        <input type="hidden" name="id" value={team.id} />
        <div className="form">
          {full && <>
            <div><label>Nom</label><input name="name" defaultValue={team.name} required /></div>
            <div><label>Abreviatura (escut de text, 2-3 lletres)</label><input name="short" defaultValue={team.short ?? ""} maxLength={4} /></div>
            <div><label>Població</label><input name="town" defaultValue={team.town ?? ""} /></div>
            <div><label>Camp (per defecte als partits de casa)</label><input name="field" defaultValue={team.field ?? ""} /></div>
            <div><label>Colors</label><input name="colors" defaultValue={team.colors ?? ""} /></div>
            <div><label>A la lliga des de</label><input name="founded" defaultValue={team.founded ?? ""} /></div>
            <div className="full"><label>Informació de l'equip</label><textarea name="info" rows={4} defaultValue={team.info ?? ""} /></div>
          </>}
          <div><label>Escut (es redimensiona a 400×400)</label>{team.logo && <img className="thumb" src={`/uploads/${team.logo}`} alt="" />}<input type="file" name="logo" accept="image/*" /></div>
          <div><label>Foto d'equip (es retalla a 3:2, 1200×800)</label>{team.photo && <img className="thumb wide" src={`/uploads/${team.photo}`} alt="" />}<input type="file" name="photo" accept="image/*" /></div>
        </div>
        <div className="actions"><button className="btn">Desar equip</button></div>
      </form>

      <h2>Galeria de fotos (per temporades)</h2>
      <form action={addTeamPhoto} className="box">
        <input type="hidden" name="teamId" value={team.id} />
        <div className="form">
          <div><label>Temporada</label><input name="season" defaultValue={seasonName} placeholder="2026-27" required /></div>
          <div><label>Peu de foto (opcional)</label><input name="caption" /></div>
          <div className="full"><label>Fotos (es poden triar diverses)</label><input type="file" name="photos" accept="image/*" multiple required /></div>
        </div>
        <div className="actions"><button className="btn">Pujar fotos</button><Link href={`/equip/${team.slug}/galeria`} target="_blank" className="gk">Veure la galeria pública ↗</Link></div>
        {gallery.length > 0 && <div className="gal" style={{ padding: "14px 0 0" }}>{gallery.map((p) => <figure key={p.id}><img src={`/uploads/${p.file}`} alt="" /><figcaption style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ flex: 1 }}>{p.season}{p.caption ? ` · ${p.caption}` : ""}</span><button className="btn ghost sm" formAction={deleteTeamPhoto} name="id" value={p.id}>×</button></figcaption></figure>)}</div>}
      </form>

      <h2>Delegats i tècnics</h2>
      <div className="box">
        <ul className="rowlist">{staff.map((s) => (
          <li key={s.id}>
            <form action={saveStaff}><input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="id" value={s.id} />
              <input name="name" defaultValue={s.name} style={{ width: 220 }} />
              <select name="role" defaultValue={s.role} style={{ width: 190 }}><option value="delegat">Delegat</option><option value="entrenador">Entrenador</option><option value="delegat-entrenador">Delegat i entrenador</option></select>
              <input name="phone" defaultValue={s.phone ?? ""} placeholder="telèfon" style={{ width: 140 }} />
              <label style={{ fontSize: 12 }}><input type="checkbox" name="phoneVisible" defaultChecked={s.phoneVisible} /> públic</label>
              <input type="hidden" name="sort" value={s.sort} />
              <button className="btn sm">Desar</button></form>
            <form action={deleteStaff}><input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="id" value={s.id} /><button className="btn ghost sm">×</button></form>
          </li>
        ))}</ul>
        <form action={saveStaff} className="actions"><input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="sort" value={staff.length} />
          <input name="name" placeholder="Nom i cognoms" style={{ width: 220 }} required />
          <select name="role" style={{ width: 190 }}><option value="delegat">Delegat</option><option value="entrenador">Entrenador</option><option value="delegat-entrenador">Delegat i entrenador</option></select>
          <input name="phone" placeholder="telèfon" style={{ width: 140 }} /><label style={{ fontSize: 12 }}><input type="checkbox" name="phoneVisible" /> públic</label>
          <button className="btn sm">+ Afegir</button></form>
      </div>

      <h2>Plantilla ({stats.filter((s) => s.player.active).length})</h2>
      <div className="box">
        <table className="mini">
          <thead><tr><th>Foto</th><th>Nº</th><th>Cognoms i nom</th><th>Pos</th><th>Naixement</th><th>PJ</th><th>G</th><th>🟨</th><th>🟥</th><th>Fitxa</th><th></th></tr></thead>
          <tbody>{stats.map(({ player: p, pj, goals, yellows, reds, remaining }) => (
            <tr key={p.id} style={p.active ? undefined : { opacity: .5 }}>
              <td>{p.photo ? <img className="thumb" src={`/uploads/${p.photo}`} alt="" style={{ width: 32, height: 42 }} /> : <span className="gk">—</span>}</td>
              <td className="num">{p.dorsal ?? ""}</td>
              <td><Link href={`/admin/jugadors/${p.id}`} style={{ fontWeight: 600 }}>{p.surname}{p.name ? ", " + p.name : ""}</Link>{remaining > 0 && <> <span className="tag susp">SANC {remaining}</span></>}{!p.active && <> <span className="tag">baixa</span></>}</td>
              <td>{p.position}</td><td className="num">{fmtDob(p.dob)}</td>
              <td className="num">{pj}</td><td className="num">{goals}</td><td className="num">{yellows || ""}</td><td className="num">{reds || ""}</td>
              <td className="gk">{p.registeredAt ?? ""}</td>
              <td><Link className="btn ghost sm" href={`/admin/jugadors/${p.id}`}>{full ? "Editar" : "Foto"}</Link></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {full && <>
        <h2>Afegir jugador</h2>
        <form action={savePlayer} className="box">
          <input type="hidden" name="teamId" value={team.id} />
          <div className="form">
            <div><label>Cognoms</label><input name="surname" required /></div>
            <div><label>Nom</label><input name="name" /></div>
            <div><label>Data de naixement</label><input type="date" name="dob" /></div>
            <div><label>Posició</label><select name="position" defaultValue="MIG">{POS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>Dorsal</label><input type="number" name="dorsal" min={0} max={99} /></div>
            <div><label>Data de la fitxa</label><input type="date" name="registeredAt" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
            <div><label>Foto (3:4)</label><input type="file" name="photo" accept="image/*" /></div>
          </div>
          <div className="actions"><button className="btn">+ Afegir jugador</button></div>
        </form>
        <details className="edit"><summary>Importar diversos jugadors (text)</summary>
          <form action={importPlayers} className="box" style={{ marginTop: 8 }}>
            <input type="hidden" name="teamId" value={team.id} />
            <label className="lbl">Un jugador per línia: <code>Cognoms, Nom, dd.mm.aaaa, POS, dorsal</code> (separat per comes, punts i coma o tabuladors — es pot enganxar des d'Excel)</label>
            <textarea name="text" rows={8} placeholder={"GARCIA LOPEZ, Joan, 12.03.1985, DEF, 4\nMARTI, Pere, 01.01.1990, POR, 1"} />
            <div className="actions"><button className="btn">Importar</button></div>
          </form>
        </details>
      </>}
      {full && <details className="edit"><summary style={{ color: "var(--red)" }}>Esborrar jugadors sense partits</summary>
        <div className="box" style={{ marginTop: 8 }}><ul className="rowlist">{stats.filter((s) => s.pj === 0 && s.goals === 0 && s.yellows === 0).map(({ player: p }) => (
          <li key={p.id}><span style={{ flex: 1 }}>{p.dorsal ?? ""} · {p.surname} {p.name}</span><form action={deletePlayer}><input type="hidden" name="id" value={p.id} /><button className="btn danger sm">Esborrar</button></form></li>
        ))}</ul></div>
      </details>}
    </>
  );
}
