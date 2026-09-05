import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";
import { fmtDate } from "@/lib/i18n";
import { type Row, type MatchFull, type Team, matchDate } from "@/lib/stats";
import { db, schema } from "@/db";
import { inArray, eq } from "drizzle-orm";
import { loadGroup } from "@/lib/stats";

type Group = typeof schema.groups.$inferSelect;

/** Google Maps link for a football field. `hint` may hold an address, e.g. the team's "Camp: name (address)" info. */
export function mapsUrl(field: string, town?: string | null, hint?: string | null) {
  const addr = hint?.match(/\(([^)]+)\)/)?.[1];
  const q = [field, addr, town && !(addr ?? "").toLowerCase().includes(town.toLowerCase()) ? town : null].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
export function MapLink({ field, town, hint }: { field: string; town?: string | null; hint?: string | null }) {
  return <a className="maplink" href={mapsUrl(field, town, hint)} target="_blank" rel="noopener" title="Google Maps">{field} <span aria-hidden>📍</span></a>;
}

export function teamInitials(team: Team) {
  const words = team.name.replace(/Veterans|Veteranos|Vet\.|d'|\bde\b|\bdel\b|\bla\b|\bFC\b|\bCF\b|\bCE\b|\bUE\b|\bEF\b|\bCEF\b|\bUCE\b|\bFVB\b/g, "").trim().split(/[\s-]+/).filter(Boolean);
  return (team.short || (words.length >= 3 ? words.slice(0, 3).map((w) => w[0]).join("") : words.length === 2 ? words[0].slice(0, 2) + words[1][0] : (words[0] || team.name).slice(0, 3))).toUpperCase();
}

export function Crest({ team, lg }: { team: Team; lg?: boolean }) {
  const initials = teamInitials(team);
  return <span className={"crest" + (lg ? " lg" : "")}>{team.logo ? <img src={`/uploads/${team.logo}`} alt="" /> : initials}</span>;
}

export function TeamLink({ team, plain }: { team: Team; plain?: boolean }) {
  if (plain) return <Link href={`/equip/${team.slug}`} style={{ color: "inherit" }}>{team.name}</Link>;
  return <Link className="team" href={`/equip/${team.slug}`}><Crest team={team} /><span>{team.name}</span></Link>;
}

export function GroupSeg({ groups, current, href, t }: { groups: Group[]; current: string; href: (g: string) => string; t: Dict }) {
  return (
    <div className="seg">
      {groups.map((g) => <Link key={g.id} className={g.name === current ? "on" : ""} href={href(g.name.toLowerCase())}>{t.grup} {g.name}</Link>)}
    </div>
  );
}

export function RoundNav({ round, date, min, max, href, t, lang }: { round: number; date?: string | null; min: number; max: number; href: (r: number) => string; t: Dict; lang: Lang }) {
  return (
    <div className="rnd">
      {round > min ? <Link href={href(round - 1)} aria-label={t.anterior}>‹</Link> : <span className="dis">‹</span>}
      <span className="lab">{t.jornada} {round}<small>{date ? fmtDate(date, lang) : "—"}</small></span>
      {round < max ? <Link href={href(round + 1)} aria-label={t.seguent}>›</Link> : <span className="dis">›</span>}
    </div>
  );
}

export function Standings({ rows, group, t, compact, highlightTeamId, prevRows }: { rows: Row[]; group: Group; t: Dict; compact?: boolean; highlightTeamId?: number | null; prevRows?: Row[] }) {
  const n = rows.length;
  const prevPos = new Map((prevRows ?? []).map((r, i) => [r.team.id, i]));
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr>
          <th></th><th>{t.equip}</th><th className="c">{t.pj}</th>
          {!compact && <><th className="c">{t.g}</th><th className="c">{t.e}</th><th className="c">{t.p}</th></>}
          <th className="c">{t.gf}</th><th className="c">{t.gc}</th><th className="c">{t.dg}</th><th className="c">{t.pts}</th>
          {!compact && <th className="c">{t.forma}</th>}
        </tr></thead>
        <tbody>
          {rows.map((r, k) => {
            const cls = [k < group.topSlots ? "lead" : "", k >= n - group.relegSlots ? "releg" : "", r.team.id === highlightTeamId ? "mine" : ""].join(" ").trim();
            const dg = r.gf - r.gc;
            return (
              <tr key={r.team.id} className={cls}>
                <td className="pos num"><span>{k + 1}</span>{prevRows && prevRows.some((r) => r.pj > 0) && (() => { const p = prevPos.get(r.team.id); if (p == null || p === k) return <i className="mv same" />; return p > k ? <i className="mv up" title={`+${p - k}`}>▲{p - k > 1 ? p - k : ""}</i> : <i className="mv down" title={`-${k - p}`}>▼{k - p > 1 ? k - p : ""}</i>; })()}</td>
                <td><TeamLink team={r.team} /></td>
                <td className="c num">{r.pj}</td>
                {!compact && <><td className="c num">{r.w}</td><td className="c num">{r.d}</td><td className="c num">{r.l}</td></>}
                <td className="c num">{r.gf}</td><td className="c num">{r.gc}</td>
                <td className="c num">{dg > 0 ? "+" : ""}{dg}</td>
                <td className="c pts num">{r.pts}</td>
                {!compact && <td className="c"><span className="form-dots">{r.form.slice(-5).map((f, i) => <i key={i} className={f} />)}</span></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ZoneLegend({ group, t }: { group: Group; t: Dict }) {
  const top = group.topLabel === "ascens" ? t.ascens : t.campio;
  const bottom = group.relegSlots === 1 ? t.ultim : t.descens;
  return (
    <>
      <span><i style={{ background: "var(--gold)" }} />{top} ({group.topSlots === 1 ? "1" : `1-${group.topSlots}`})</span>
      <span><i style={{ background: "var(--red)" }} />{bottom}</span>
    </>
  );
}

export function FixtureList({ matches, t, lang, showDate }: { matches: MatchFull[]; t: Dict; lang: Lang; showDate?: boolean }) {
  if (!matches.length) return <p className="empty">{t.capResultat}</p>;
  const refIds = [...new Set(matches.map((m) => m.refereeId).filter(Boolean))] as number[];
  const refNames = refIds.length ? new Map(db.select().from(schema.referees).where(inArray(schema.referees.id, refIds)).all().map((r) => [r.id, r.name])) : null;
  return (
    <ul className="fx">
      {matches.map((m) => {
        const played = (m.status === "played" || m.status === "walkover") && m.homeGoals != null;
        const score = played ? <span className="s">{m.homeGoals}–{m.awayGoals}</span>
          : m.status === "postponed" ? <span className="s post">{t.ajornat}</span>
          : <span className="s t">{m.time || "–:–"}</span>;
        const inner = (
          <>
            <span className="h">{m.home.name}</span>{score}<span className="a">{m.away.name}</span>
            <span className="meta">
              {played ? <b>{t.acta} ›</b> : <span>{fmtDate(matchDate(m), lang, false)}{!m.time && m.status === "scheduled" ? ` · ${t.horaPerConfirmar}` : ""}</span>}
              {showDate && played && <span>{fmtDate(matchDate(m), lang, false)}</span>}
              {(m.field || m.home.field) && <span>{m.field || m.home.field}</span>}
              {m.refereeId && !played && refNames?.get(m.refereeId) && <span>⚑ {refNames.get(m.refereeId)}</span>}
              {m.status === "walkover" && <span>{t.noPresentat}</span>}
            </span>
          </>
        );
        return <li key={m.id}>{played || m.refereeId ? <Link href={`/partit/${m.id}`}>{inner}</Link> : <div className="row">{inner}</div>}</li>;
      })}
    </ul>
  );
}

export function QuickLinks({ t, g }: { t: Dict; g: string }) {
  return (
    <div className="quick">
      <Link href={`/golejadors/${g}`}><b>{t.golejadors}</b><span>{t.golejadorsSub}</span></Link>
      <Link href={`/sancions/${g}`}><b>{t.sancions}</b><span>{t.sancionsSub}</span></Link>
      <Link href={`/calendari/${g}`}><b>{t.calendari}</b><span>{t.calendariSub}</span></Link>
      <Link href="/normatives/reglament"><b>{t.reglament}</b><span>{t.reglamentSub}</span></Link>
    </div>
  );
}

/** Matches moved off their round date (postponed or rescheduled) that are still to be played. */
export function PendingMatches({ matches, t, lang }: { matches: MatchFull[]; t: Dict; lang: Lang }) {
  const list = matches.filter((m) => (m.status === "postponed" || (m.status === "scheduled" && m.date && m.date !== m.round.date))).sort((a, b) => matchDate(a).localeCompare(matchDate(b)));
  if (!list.length) return null;
  return (
    <div className="panel" style={{ marginTop: 22 }}>
      <div className="panel-h"><h2>{t.partitsEndarrerits}</h2><span className="gk" style={{ marginLeft: "auto" }}>{list.length}</span></div>
      <div className="panel-b"><ul className="fx">{list.map((m) => (
        <li key={m.id}><div className="row"><span className="h">{m.home.name}</span>{m.status === "postponed" ? <span className="s post">{t.ajornat}</span> : <span className="s t">{m.time || "–:–"}</span>}<span className="a">{m.away.name}</span>
          <span className="meta"><span>J{m.round.number}</span><span>{m.status === "postponed" && !m.date ? t.dataPerConfirmar : fmtDate(matchDate(m), lang)}</span>{(m.field || m.home.field) && <span>{m.field || m.home.field}</span>}</span></div></li>
      ))}</ul></div>
    </div>
  );
}

export function Birthdays({ groupId, t, lang }: { groupId: number; t: Dict; lang: Lang }) {
  const { teams } = loadGroup(groupId);
  const ids = teams.map((x) => x.id); if (!ids.length) return null;
  const players = db.select().from(schema.players).where(inArray(schema.players.teamId, ids)).all().filter((p) => p.active && p.dob);
  const today = new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()));
  const within = (iso: string) => { const [by, m, d] = iso.split("-").map(Number); const y = today.getFullYear(); let bd = new Date(y, m - 1, d); let dd = Math.round((bd.getTime() - today.getTime()) / 86400000); if (dd < -1) { bd = new Date(y + 1, m - 1, d); dd = Math.round((bd.getTime() - today.getTime()) / 86400000); } return dd >= -1 && dd <= 6 ? { dd, age: bd.getFullYear() - by, bd } : null; };
  const list = players.map((p) => ({ p, w: within(p.dob!) })).filter((x) => x.w).sort((a, b) => a.w!.dd - b.w!.dd);
  if (!list.length) return null;
  const teamById = new Map(teams.map((x) => [x.id, x]));
  void eq;
  return (
    <div className="panel bday" style={{ marginTop: 22 }}>
      <div className="panel-h"><h2>🎂 {t.aniversaris}</h2></div>
      <div className="panel-b bday-list">{list.map(({ p, w }) => { const { dd, age, bd } = w!; const iso = `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, "0")}-${String(bd.getDate()).padStart(2, "0")}`; return (
        <Link key={p.id} href={`/jugador/${p.id}`} className="bday-item"><b>{p.name ? `${p.name} ${p.surname}` : p.surname}</b><span>{teamById.get(p.teamId)?.name} · {dd === 0 ? t.avui : dd === -1 ? t.ahir : dd === 1 ? t.dema : fmtDate(iso, lang, false)} · {age} {t.anys}</span></Link>); })}</div>
    </div>
  );
}
