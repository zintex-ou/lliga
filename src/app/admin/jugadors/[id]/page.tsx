import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, canEditMatches } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { savePlayer } from "@/lib/actions";

export const dynamic = "force-dynamic";
const POS = ["POR", "DEF", "MIG", "DAV"];

export default async function PlayerAdmin({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = db.select().from(schema.players).where(eq(schema.players.id, Number(id))).get();
  if (!p) notFound();
  const full = canEditMatches(user.role);
  if (!full && !(user.role === "delegat" && user.teamId === p.teamId)) redirect("/admin");
  const team = db.select().from(schema.teams).where(eq(schema.teams.id, p.teamId)).get()!;
  return (
    <>
      <div className="actions" style={{ marginTop: 0 }}><Link href={`/admin/equips/${team.id}`}>← {team.name}</Link><Link href={`/jugador/${p.id}`} target="_blank" style={{ marginLeft: "auto" }}>Fitxa pública ↗</Link></div>
      <h1>{p.surname}{p.name ? ", " + p.name : ""}</h1>
      <form action={savePlayer} className="box">
        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="teamId" value={p.teamId} />
        <div className="form">
          {full && <>
            <div><label>Cognoms</label><input name="surname" defaultValue={p.surname} required /></div>
            <div><label>Nom</label><input name="name" defaultValue={p.name} /></div>
            <div><label>Data de naixement</label><input type="date" name="dob" defaultValue={p.dob ?? ""} /></div>
            <div><label>Posició</label><select name="position" defaultValue={p.position}>{POS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>Dorsal</label><input type="number" name="dorsal" min={0} max={99} defaultValue={p.dorsal ?? ""} /></div>
            <div><label>Data de la fitxa</label><input type="date" name="registeredAt" defaultValue={p.registeredAt ?? ""} /></div>
            <div><label>Estat</label><label style={{ fontSize: 14, color: "var(--ink)" }}><input type="checkbox" name="active" defaultChecked={p.active} /> Actiu (desmarca per donar de baixa: desapareix de les actes però conserva les estadístiques)</label></div>
          </>}
          <div><label>Foto (es retalla a 3:4, 600×800)</label>{p.photo && <img className="thumb" src={`/uploads/${p.photo}`} alt="" style={{ width: 90, height: 120 }} />}<input type="file" name="photo" accept="image/*" /></div>
        </div>
        <div className="actions"><button className="btn">Desar</button></div>
      </form>
    </>
  );
}
