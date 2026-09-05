import Link from "next/link";
import { getUser, ROLE_LABEL, canEditMatches, isAdmin } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) return <>{children}</>;
  const team = user.teamId ? db.select().from(schema.teams).where(eq(schema.teams.id, user.teamId)).get() : null;
  const content = canEditMatches(user.role);
  return (
    <div className="admin">
      <aside>
        <div className="brand disp"><Link href="/" style={{ color: "#fff" }}>← Futbol Empreses Girona</Link></div>
        <div className="who"><b>{user.name}</b>{ROLE_LABEL[user.role]}{team ? ` · ${team.name}` : ""}</div>
        <Link href="/admin">Inici</Link>
        {content && <>
          <Link href="/admin/partits">Partits i actes<small>Resultats, gols, targetes</small></Link>
          <Link href="/admin/rapid">Resultat ràpid<small>Només el marcador, des del mòbil</small></Link>
          <Link href="/admin/calendari">Calendari i horaris<small>Data, hora, camp</small></Link>
          <Link href="/admin/equips">Equips i jugadors<small>Fitxes, fotos, delegats</small></Link>
          <Link href="/admin/sancions">Sancions<small>Vigents i manuals</small></Link>
          <Link href="/admin/arbitres">Arbitratge<small>Àrbitres i designacions</small></Link>
          <Link href="/admin/avisos">Avisos d'errors<small>Formulari del web</small></Link>
          <Link href="/admin/estadistiques">Visites<small>Estadístiques del web</small></Link>
          <Link href="/admin/comunicats">Comunicats<small>Notícies i circulars</small></Link>
          <Link href="/admin/documents">Normatives i documents<small>Textos i PDF</small></Link>
        </>}
        {user.role === "delegat" && team && <Link href={`/admin/equips/${team.id}`}>El meu equip<small>Fotos i delegats</small></Link>}
        {user.role === "arbitre" && <Link href="/admin">Les meves designacions<small>Partits assignats</small></Link>}
        {isAdmin(user.role) && <>
          <Link href="/admin/usuaris">Usuaris<small>Rols i accés</small></Link>
          <Link href="/admin/configuracio">Configuració<small>Temporada, sancions, grups</small></Link>
        </>}
        <form action={logoutAction} style={{ padding: "14px 16px" }}><button className="btn ghost sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>Sortir</button></form>
      </aside>
      <main>{children}</main>
    </div>
  );
}
