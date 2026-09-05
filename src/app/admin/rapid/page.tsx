import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupsAdmin, loadGroup } from "@/lib/stats";
import { fmtDate } from "@/lib/i18n";
import { parseRound } from "@/lib/group";
import { quickScore, publishMatches } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Phone-friendly: enter only the final score for each match of a round; lineups, goals and cards can be completed later in the acta. */
export default async function Rapid({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("content");
  const sp = await searchParams;
  const groups = getGroupsAdmin();
  const group = groups.find((g) => g.name === (sp.g || "A").toUpperCase()) ?? groups[0];
  const d = loadGroup(group.id, true);
  const round = parseRound(sp.j, d.nextRound, d.rounds.length);
  const matches = d.matches.filter((m) => m.round.number === round);
  const r = d.rounds.find((x) => x.number === round);
  return (
    <div className="rapid">
      <h1>Resultat ràpid</h1>
      <div className="actions" style={{ marginTop: 0 }}>
        <div className="seg">{groups.map((g) => <Link key={g.id} className={g.id === group.id ? "on" : ""} href={`/admin/rapid?g=${g.name}&j=${round}`}>Grup {g.name}</Link>)}</div>
        <div className="rnd" style={{ marginLeft: 0 }}>
          {round > 1 ? <Link href={`/admin/rapid?g=${group.name}&j=${round - 1}`}>‹</Link> : <span className="dis">‹</span>}
          <span className="lab">J{round}<small>{r ? fmtDate(r.date, "ca", false) : ""}</small></span>
          {round < d.rounds.length ? <Link href={`/admin/rapid?g=${group.name}&j=${round + 1}`}>›</Link> : <span className="dis">›</span>}
        </div>
      </div>
      <p className="gk">Només el resultat. Alineació, gols i targetes es completen després a <Link href={`/admin/partits?g=${group.name}&j=${round}`}>l&apos;acta</Link>. Els resultats es desen com a <b>esborrany</b>; quan tots siguin correctes, publica la jornada (envia les notificacions).</p>
      {matches.some((m) => !m.published && (m.status === "played" || m.status === "walkover")) && (
        <form action={publishMatches} className="box" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {matches.filter((m) => !m.published).map((m) => <input key={m.id} type="hidden" name="matchId" value={m.id} />)}
          <button className="btn">🔔 Publicar la jornada {round}</button><span className="gk">{matches.filter((m) => !m.published && (m.status === "played" || m.status === "walkover")).length} resultats en esborrany</span>
        </form>
      )}
      {matches.map((m) => (
        <form key={m.id} action={quickScore} className={`rapid-m ${m.status}`}>
          <input type="hidden" name="matchId" value={m.id} />
          <div className="rapid-teams"><span>{m.home.name}</span><span>{m.away.name}</span></div>
          <div className="rapid-score">
            <input type="number" inputMode="numeric" name="hg" min={0} max={30} defaultValue={m.homeGoals ?? ""} placeholder="–" required />
            <b>:</b>
            <input type="number" inputMode="numeric" name="ag" min={0} max={30} defaultValue={m.awayGoals ?? ""} placeholder="–" required />
            <button className="btn">{m.status === "played" ? "✓" : "Desar"}</button>
          </div>
          <label className="gk" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 6 }}><input type="checkbox" name="publish" /> publicar de seguida</label>
          <div className="gk" style={{ marginTop: 4 }}>{m.time ? `${m.time} · ` : ""}{m.field || m.home.field || ""}{m.status === "played" ? (m.published ? " · publicat" : " · esborrany") : m.status === "postponed" ? " · ajornat" : ""} · <Link href={`/admin/partits/${m.id}`}>acta completa</Link></div>
        </form>
      ))}
    </div>
  );
}
