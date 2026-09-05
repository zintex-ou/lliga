import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getT } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export default async function Contacte() {
  const { t } = await getT();
  const page = db.select().from(schema.pages).where(eq(schema.pages.slug, "contacte")).get();
  return (
    <div className="panel">
      <div className="panel-h"><h1>{t.contacte}</h1></div>
      {page?.body ? <div className="prose">{page.body}</div> : <p className="empty">{t.senseContingut}</p>}
    </div>
  );
}
