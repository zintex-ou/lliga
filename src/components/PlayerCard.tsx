import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import type { PlayerStats, Team } from "@/lib/stats";
import { teamInitials } from "@/components/public";

/** FUT-style player card: gradient shield, big number, photo, name band and a stats strip. */
export function PlayerCard({ s, team, t, size = "lg", href, assists = true }: { s: PlayerStats; team: Team; t: Dict; size?: "lg" | "sm"; href?: string; assists?: boolean }) {
  const p = s.player;
  const gk = p.position === "POR";
  const inner = (
    <div className={`fut fut-${size} pos-${p.position}${s.remaining > 0 ? " fut-susp" : ""}`}>
      <div className="fut-shine" />
      <div className="fut-top">
        <div className="fut-num">{p.dorsal ?? "–"}</div>
        <div className="fut-pos">{t[`${p.position}_s` as "POR_s"]}</div>
        <div className="fut-crest">{team.logo ? <img src={`/uploads/${team.logo}`} alt="" /> : <span>{teamInitials(team)}</span>}</div>
      </div>
      <div className="fut-photo">
        {p.photo ? <img src={`/uploads/${p.photo}`} alt="" /> : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
        )}
      </div>
      <div className="fut-name">{p.surname}{size === "lg" && p.name ? <small>{p.name}</small> : null}</div>
      <div className="fut-stats">
        <div><b>{s.pj}</b><span>{t.pj}</span></div>
        <div><b>{s.goals}</b><span>{t.g}</span></div>
        {assists && <div><b>{s.assists}</b><span>{t.ass.replace(".", "")}</span></div>}
        {gk && <div><b>{s.conceded}</b><span>{t.gc}</span></div>}
        <div><b>{s.yellows}</b><span><i className="card y" /></span></div>
        <div><b>{s.reds}</b><span><i className="card r" /></span></div>
      </div>
      {s.remaining > 0 && <div className="fut-badge">{t.sancionat} · {s.remaining}</div>}
    </div>
  );
  return href ? <Link href={href} className="fut-link">{inner}</Link> : inner;
}
