import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { matchDetails, matchDate, playerName, teamPlayerStats } from "@/lib/stats";

export const runtime = "nodejs";

/** Open Graph images: /og/site · /og/partit/<id> · /og/equip/<slug> · /og/jugador/<id> */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ p: string[] }> }) {
  const { p } = await params;
  const [kind, key] = p;
  const site = process.env.SITE_URL || new URL(_req.url).origin;
  const logo = `${site}/logo.png`;
  const frame = (content: React.ReactNode, sub?: string) => new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: "#17181C", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", height: 14, width: "100%" }}>{Array.from({ length: 9 }).map((_, i) => <div key={i} style={{ flex: 1, background: i % 2 ? "#DA121A" : "#FCDD09" }} />)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "28px 56px 0" }}>
          <img src={logo} width={72} height={72} style={{ borderRadius: 36, background: "#fff" }} />
          <div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: 30, fontWeight: 700 }}>Futbol Empreses Girona</div><div style={{ fontSize: 16, letterSpacing: 3, color: "#B9BCC3" }}>AMICS DEL FUTBOL AMATEUR · CAMPIONATS PER A VETERANS</div></div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 56px" }}>{content}</div>
        {sub && <div style={{ padding: "0 56px 36px", fontSize: 24, color: "#B9BCC3" }}>{sub}</div>}
      </div>
    ), { width: 1200, height: 630 });

  if (kind === "partit") {
    const d = matchDetails(Number(key)); if (!d) return new Response("Not found", { status: 404 });
    const m = d.match; const played = (m.status === "played" || m.status === "walkover") && m.homeGoals != null && m.published;
    return frame(
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
        <div style={{ flex: 1, fontSize: 48, fontWeight: 700, textAlign: "right" }}>{m.home.name}</div>
        <div style={{ fontSize: played ? 110 : 40, fontWeight: 800, background: played ? "#C8102E" : "#2A2B31", borderRadius: 24, padding: "10px 40px", letterSpacing: 4 }}>{played ? `${m.homeGoals}–${m.awayGoals}` : (m.time || "–:–")}</div>
        <div style={{ flex: 1, fontSize: 48, fontWeight: 700 }}>{m.away.name}</div>
      </div>,
      `Jornada ${m.round.number} · ${matchDate(m)}${m.field || m.home.field ? ` · ${m.field || m.home.field}` : ""}`);
  }
  if (kind === "equip") {
    const team = db.select().from(schema.teams).where(eq(schema.teams.slug, key)).get(); if (!team) return new Response("Not found", { status: 404 });
    return frame(
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        {team.logo && <img src={`${site}/uploads/${team.logo}`} width={200} height={200} style={{ borderRadius: 100, background: "#fff" }} />}
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1 }}>{team.name}</div>
      </div>, [team.town, team.field].filter(Boolean).join(" · "));
  }
  if (kind === "jugador") {
    const pl = db.select().from(schema.players).where(eq(schema.players.id, Number(key))).get(); if (!pl) return new Response("Not found", { status: 404 });
    const team = db.select().from(schema.teams).where(eq(schema.teams.id, pl.teamId)).get()!;
    const st = teamPlayerStats(team).find((s) => s.player.id === pl.id);
    return frame(
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        {pl.photo && <img src={`${site}/uploads/${pl.photo}`} width={210} height={280} style={{ borderRadius: 20, objectFit: "cover" }} />}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#FCDD09", fontWeight: 700 }}>{pl.dorsal != null ? `#${pl.dorsal} · ` : ""}{pl.position}</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{playerName(pl)}</div>
          {st && <div style={{ fontSize: 30, color: "#B9BCC3", marginTop: 14 }}>{st.pj} PJ · {st.goals} gols · {st.yellows}🟨 {st.reds}🟥</div>}
        </div>
      </div>, team.name);
  }
  return frame(<div style={{ fontSize: 72, fontWeight: 800 }}>Classificació, resultats i calendari</div>, "Lliga de veterans · Girona");
}
