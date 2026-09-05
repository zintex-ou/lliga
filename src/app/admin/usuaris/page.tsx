import { requireUser, ROLE_LABEL, type Role } from "@/lib/auth";
import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import { saveUser, deleteUser } from "@/lib/actions";

export const dynamic = "force-dynamic";
const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default async function Usuaris() {
  const me = await requireUser("admin");
  const users = db.select().from(schema.users).orderBy(asc(schema.users.role), asc(schema.users.name)).all();
  const teams = db.select().from(schema.teams).orderBy(asc(schema.teams.name)).all();
  const refs = db.select().from(schema.referees).orderBy(asc(schema.referees.name)).all();
  const Form = ({ u }: { u?: typeof users[number] }) => (
    <form action={saveUser} className="box">
      {u && <input type="hidden" name="id" value={u.id} />}
      <div className="form">
        <div><label>Nom</label><input name="name" defaultValue={u?.name ?? ""} required /></div>
        <div><label>Correu (usuari)</label><input type="email" name="email" defaultValue={u?.email ?? ""} required /></div>
        <div><label>Rol</label><select name="role" defaultValue={u?.role ?? "president_lliga"}>{ROLES.filter((r) => r !== "visitant").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
        <div><label>Equip (només delegats)</label><select name="teamId" defaultValue={u?.teamId ?? ""}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label>Àrbitre (només rol Àrbitre)</label><select name="refereeId" defaultValue={u?.refereeId ?? ""}><option value="">—</option>{refs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><label>{u ? "Nova contrasenya (buit = no canviar)" : "Contrasenya"}</label><input type="password" name="password" minLength={8} required={!u} autoComplete="new-password" /></div>
        <div><label>&nbsp;</label><label style={{ color: "var(--ink)", fontSize: 14 }}><input type="checkbox" name="active" defaultChecked={u ? u.active : true} /> Actiu</label></div>
      </div>
      <div className="actions"><button className="btn">{u ? "Desar" : "+ Crear usuari"}</button></div>
    </form>
  );
  return (
    <>
      <h1>Usuaris</h1>
      <div className="box" style={{ fontSize: 14 }}>
        <b>Admin</b> — tot. <b>President de la lliga</b> i <b>President del comitè d'àrbitres</b> — actes, calendari, equips, sancions, comunicats, documents. <b>Delegat</b> — fotos i delegats del seu equip. <b>Àrbitre</b> — només veu les seves designacions (i pot afegir-les al calendari del mòbil).
      </div>
      <h2>Nou usuari</h2><Form />
      <h2>Usuaris existents</h2>
      {users.map((u) => (
        <details key={u.id} className="edit"><summary>{u.name} · {u.email} · {ROLE_LABEL[u.role as Role]}{!u.active && " (inactiu)"}</summary>
          <Form u={u} />
          {u.id !== me.id && <form action={deleteUser} style={{ marginTop: 6 }}><input type="hidden" name="id" value={u.id} /><button className="btn danger sm">Esborrar</button></form>}
        </details>
      ))}
    </>
  );
}
