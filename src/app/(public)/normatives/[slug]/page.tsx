import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { eq, desc, asc } from "drizzle-orm";
import { getT, fmtDate } from "@/lib/i18n";

export const dynamic = "force-dynamic";
const PAGES = ["normativa", "reglament", "arbitratges"];

export default async function NormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { lang, t } = await getT();
  if (slug === "circulars") {
    const posts = db.select().from(schema.posts).where(eq(schema.posts.published, true)).orderBy(desc(schema.posts.publishedAt), desc(schema.posts.id)).all();
    const docs = db.select().from(schema.documents).where(eq(schema.documents.category, "circulars")).orderBy(asc(schema.documents.sort), desc(schema.documents.id)).all();
    return (
      <div className="panel news" style={{ marginTop: 0 }}>
        <div className="panel-h"><h1>{t.circulars}</h1></div>
        <div className="panel-b">
          {posts.length === 0 && docs.length === 0 && <p className="empty">{t.senseContingut}</p>}
          {posts.map((p) => <article key={p.id}><time>{fmtDate(p.publishedAt.slice(0, 10), lang)}</time><div><h3>{p.title}</h3><p>{p.body}</p></div></article>)}
          {docs.length > 0 && <ul className="doclist" style={{ marginTop: 12 }}>{docs.map((d) => <li key={d.id}><span>{d.title}</span>{d.file && <a className="btn sm ghost" href={`/uploads/${d.file}`} target="_blank">{t.descarregar}</a>}</li>)}</ul>}
        </div>
      </div>
    );
  }
  const docsCat = slug === "documentacio" ? "documentacio" : slug;
  const docs = db.select().from(schema.documents).where(eq(schema.documents.category, docsCat)).orderBy(asc(schema.documents.sort), desc(schema.documents.id)).all();
  const page = PAGES.includes(slug) ? db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).get() : null;
  if (!page && slug !== "documentacio") notFound();
  const title = page?.title ?? t.documentacio;
  return (
    <div className="panel">
      <div className="panel-h"><h1>{title}</h1></div>
      {page?.body ? <div className="prose">{page.body}</div> : docs.length === 0 ? <p className="empty">{t.senseContingut}</p> : null}
      {docs.length > 0 && (
        <div className="panel-b"><h3 style={{ margin: "4px 0 8px" }}>{t.documents}</h3>
          <ul className="doclist">{docs.map((d) => <li key={d.id}><span>{d.title}{d.body ? <span className="gk"> — {d.body}</span> : ""}</span>{d.file && <a className="btn sm ghost" href={`/uploads/${d.file}`} target="_blank">{t.descarregar}</a>}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
