import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import { saveDocument, deleteDocument, savePage } from "@/lib/actions";

export const dynamic = "force-dynamic";
const CATS: [string, string][] = [["normativa", "Normativa veterans"], ["reglament", "Reglament"], ["arbitratges", "Arbitratges"], ["documentacio", "Documentació"], ["circulars", "Circulars"]];

export default async function Documents() {
  await requireUser("content");
  const pages = db.select().from(schema.pages).all();
  const docs = db.select().from(schema.documents).orderBy(asc(schema.documents.category), asc(schema.documents.sort)).all();
  return (
    <>
      <h1>Normatives i documents</h1>
      <h2 style={{ marginTop: 0 }}>Textos de les pàgines</h2>
      {pages.filter((p) => p.slug !== "inici").map((p) => (
        <details key={p.slug} className="edit"><summary>{p.title} <span className="gk">({p.body ? `${p.body.length} caràcters` : "buit"})</span></summary>
          <form action={savePage} className="box" style={{ marginTop: 8 }}>
            <input type="hidden" name="slug" value={p.slug} />
            <div className="form"><div className="full"><label>Títol</label><input name="title" defaultValue={p.title} /></div>
              <div className="full"><label>Text (els salts de línia es respecten)</label><textarea name="body" rows={14} defaultValue={p.body} /></div></div>
            <div className="actions"><button className="btn">Desar</button></div>
          </form>
        </details>
      ))}
      <h2>Fitxers (PDF, imatges)</h2>
      <form action={saveDocument} className="box">
        <div className="form">
          <div><label>Títol</label><input name="title" required /></div>
          <div><label>Secció</label><select name="category">{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label>Fitxer</label><input type="file" name="file" accept=".pdf,image/*" /></div>
          <div><label>Descripció curta</label><input name="body" /></div>
        </div>
        <div className="actions"><button className="btn">+ Afegir document</button></div>
      </form>
      <div className="box"><ul className="rowlist">{docs.map((d) => (
        <li key={d.id}><span className="tag">{CATS.find((c) => c[0] === d.category)?.[1] ?? d.category}</span><span style={{ flex: 1 }}><b>{d.title}</b>{d.body ? <span className="gk"> — {d.body}</span> : ""}</span>
          {d.file && <a className="btn ghost sm" href={`/uploads/${d.file}`} target="_blank">Obrir</a>}
          <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><button className="btn ghost sm">×</button></form></li>
      ))}{docs.length === 0 && <li className="gk">Cap document.</li>}</ul></div>
    </>
  );
}
