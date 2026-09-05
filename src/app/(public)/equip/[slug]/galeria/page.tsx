import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { eq, desc, asc } from "drizzle-orm";
import { getT } from "@/lib/i18n";
import { teamKey } from "@/lib/stats";
import { Crest } from "@/components/public";

export const dynamic = "force-dynamic";

export default async function Galeria({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getT();
  const team = db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).get();
  if (!team) notFound();
  const photos = db.select().from(schema.teamPhotos).where(eq(schema.teamPhotos.teamKey, teamKey(team.name))).orderBy(desc(schema.teamPhotos.season), asc(schema.teamPhotos.sort), asc(schema.teamPhotos.id)).all();
  const seasons = [...new Set(photos.map((p) => p.season))];
  return (
    <div className="panel">
      <div className="panel-h"><Crest team={team} /><h1>{team.name} · {t.galeria}</h1><Link href={`/equip/${team.slug}`} style={{ marginLeft: "auto", fontSize: 13 }}>← {t.tornaEquip}</Link></div>
      {photos.length === 0 && <p className="empty">{t.senseContingut}</p>}
      {seasons.map((s) => (
        <div key={s}>
          <div className="panel-h" style={{ borderTop: "1px solid var(--line)" }}><h2>{t.temporada} {s}</h2></div>
          <div className="gal">{photos.filter((p) => p.season === s).map((p) => <figure key={p.id}><a href={`/uploads/${p.file}`} target="_blank"><img src={`/uploads/${p.file}`} alt={p.caption ?? ""} loading="lazy" /></a>{p.caption && <figcaption>{p.caption}</figcaption>}</figure>)}</div>
        </div>
      ))}
    </div>
  );
}
