import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { savePost, deletePost, pushBroadcast } from "@/lib/actions";
import { db as db2, schema as schema2 } from "@/db";

export const dynamic = "force-dynamic";

export default async function Comunicats() {
  await requireUser("content");
  const posts = db.select().from(schema.posts).orderBy(desc(schema.posts.publishedAt), desc(schema.posts.id)).all();
  const Form = ({ p }: { p?: typeof posts[number] }) => (
    <form action={savePost} className="box">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="form">
        <div className="full"><label>Títol</label><input name="title" defaultValue={p?.title ?? ""} required /></div>
        <div className="full"><label>Text</label><textarea name="body" rows={6} defaultValue={p?.body ?? ""} /></div>
        <div><label>Tipus</label><select name="kind" defaultValue={p?.kind ?? "noticia"}><option value="noticia">Notícia</option><option value="circular">Circular</option></select></div>
        <div><label>Data</label><input type="date" name="publishedAt" defaultValue={p?.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} /></div>
        <div><label>&nbsp;</label><label style={{ color: "var(--ink)", fontSize: 14 }}><input type="checkbox" name="published" defaultChecked={p ? p.published : true} /> Publicat</label> <label style={{ color: "var(--ink)", fontSize: 14, marginLeft: 12 }}><input type="checkbox" name="push" /> 🔔 Enviar notificació push</label></div>
      </div>
      <div className="actions"><button className="btn">{p ? "Desar" : "Publicar"}</button></div>
    </form>
  );
  return (
    <>
      <h1>Comunicats</h1>
      <p className="gk">Es mostren a la portada i a Normatives → Circulars. Per enviar-los per WhatsApp, copia el text i el títol des d'aquí.</p>
      <Form />
      <h2>Notificació push directa</h2>
      <form action={pushBroadcast} className="box">
        <div className="form"><div><label>Títol</label><input name="title" required /></div><div><label>Enllaç (opcional)</label><input name="url" placeholder="/calendari/b" /></div><div className="full"><label>Text</label><input name="body" /></div></div>
        <div className="actions"><button className="btn">🔔 Enviar a tots els subscrits ({db2.select().from(schema2.pushSubscriptions).all().length})</button><span className="gk">Els subscrits d&apos;un equip o grup també la reben.</span></div>
      </form>
      <h2>Publicats</h2>
      {posts.map((p) => (
        <details key={p.id} className="edit"><summary>{p.publishedAt.slice(0, 10)} · {p.title}{!p.published && " (esborrany)"}</summary>
          <Form p={p} />
          <form action={deletePost} style={{ marginTop: 6 }}><input type="hidden" name="id" value={p.id} /><button className="btn danger sm">Esborrar</button></form>
        </details>
      ))}
    </>
  );
}
