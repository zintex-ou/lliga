import { requireUser } from "@/lib/auth";
import { getActiveSeason, getGroupsAdmin, siteLogo } from "@/lib/stats";
import { saveSettings, createSeason, importCalendar, saveTeamGroupList, savePopup } from "@/lib/actions";
import { getSetting } from "@/lib/stats";
import { getAllSeasons } from "@/lib/stats";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Config() {
  await requireUser("admin");
  const season = getActiveSeason(); const groups = getGroupsAdmin(); const seasons = getAllSeasons();
  const roundsCount = (gid: number) => db.select().from(schema.rounds).where(eq(schema.rounds.groupId, gid)).all().length;
  const teamsCount = (gid: number) => db.select().from(schema.teams).where(eq(schema.teams.groupId, gid)).all().length;
  return (
    <>
      <h1>Configuració</h1>
      <form action={saveSettings} className="box">
        <input type="hidden" name="seasonId" value={season.id} />
        <div className="form">
          <div><label>Temporada</label><input name="name" defaultValue={season.name} /></div>
          <div><label>Grogues acumulades per a 1 partit de sanció</label><input type="number" name="yellowsForBan" min={2} max={20} defaultValue={season.yellowsForBan} /></div>
          <div className="full"><label>Logotip del web (PNG o SVG, fons transparent)</label><img src={siteLogo()} alt="" className="thumb" style={{ objectFit: "contain", background: "#fff" }} /><input type="file" name="logo" accept="image/png,image/svg+xml,image/jpeg" /></div>
          <div className="full"><label style={{ color: "var(--ink)", fontSize: 14 }}><input type="checkbox" name="assistsEnabled" defaultChecked={season.assistsEnabled} /> Comptar assistències (mostra la pestanya Assistents i la columna a les actes)</label></div>
          {groups.map((g) => (
            <div key={g.id} className="full box" style={{ boxShadow: "none" }}>
              <input type="hidden" name="groupId" value={g.id} />
              <b>Grup {g.name}</b>
              <div className="form" style={{ marginTop: 6 }}>
                <div><label>Places destacades a dalt</label><input type="number" name={`top_${g.id}`} min={0} max={5} defaultValue={g.topSlots} /></div>
                <div><label>Etiqueta</label><select name={`label_${g.id}`} defaultValue={g.topLabel}><option value="campio">Campió</option><option value="ascens">Ascens</option></select></div>
                <div><label>Places de descens / últim</label><input type="number" name={`releg_${g.id}`} min={0} max={5} defaultValue={g.relegSlots} /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="actions"><button className="btn">Desar</button></div>
      </form>

      <h2>Finestra emergent (popup) a la portada</h2>
      <form action={savePopup} className="box">
        <div className="form">
          <div className="full"><label style={{ color: "var(--ink)", fontSize: 15, fontWeight: 600 }}><input type="checkbox" name="enabled" defaultChecked={getSetting("popup_enabled") === "1"} /> Activar el popup (es mostra a tothom un cop; en tancar-lo no torna a sortir)</label></div>
          <div className="full"><label>Títol</label><input name="title" defaultValue={getSetting("popup_title") ?? ""} placeholder="Bon Nadal! · Campions 2026-27 · …" /></div>
          <div className="full"><label>Text</label><textarea name="body" rows={4} defaultValue={getSetting("popup_body") ?? ""} /></div>
          <div><label>Mostrar des de (opcional)</label><input type="datetime-local" name="from" defaultValue={getSetting("popup_from") ?? ""} /></div>
          <div><label>Fins a (opcional)</label><input type="datetime-local" name="to" defaultValue={getSetting("popup_to") ?? ""} /></div>
          <div><label>Imatge (foto dels campions, felicitació…)</label>{getSetting("popup_image") && <img className="thumb wide" src={`/uploads/${getSetting("popup_image")}`} alt="" />}<input type="file" name="image" accept="image/*" /></div>
          <div><label>&nbsp;</label>{getSetting("popup_image") && <label style={{ color: "var(--ink)", fontSize: 14 }}><input type="checkbox" name="removeImage" /> Treure la imatge</label>}</div>
          <div className="full"><label style={{ color: "var(--ink)", fontSize: 14 }}><input type="checkbox" name="bump" /> Tornar a mostrar-lo a tothom (també a qui ja l&apos;havia tancat) — marca-ho quan canviïs el contingut</label></div>
        </div>
        <div className="actions"><button className="btn">Desar popup</button><span className="gk">Només l&apos;administrador pot activar-lo.</span></div>
      </form>

      <h2>Temporades i arxiu</h2>
      <div className="box">
        <p className="gk" style={{ marginTop: 0 }}>Temporades: {seasons.map((s) => `${s.name}${s.active ? " (actual)" : ""}`).join(" · ")}. Les temporades anteriors queden a l'arxiu públic (menú Lliga → Arxiu) amb classificacions, resultats i plantilles.</p>
        <details className="edit"><summary>Crear una nova temporada (l'actual passa a l'arxiu)</summary>
          <form action={createSeason} className="form" style={{ marginTop: 8 }}>
            <div><label>Nom (p. ex. 2027-28)</label><input name="name" required placeholder="2027-28" /></div>
            <div><label>&nbsp;</label><label style={{ color: "var(--ink)", fontSize: 14 }}><input type="checkbox" name="copyTeams" defaultChecked /> Copiar equips, delegats i jugadors actius</label></div>
            <div className="full"><button className="btn danger">Crear temporada nova</button> <span className="gk">Després: revisa els grups (ascensos/descensos) i importa el calendari.</span></div>
          </form>
        </details>
        {groups.map((g) => (
          <details key={g.id} className="edit"><summary>Grup {g.name} — {teamsCount(g.id)} equips, {roundsCount(g.id)} jornades</summary>
            <form action={saveTeamGroupList} className="form" style={{ marginTop: 8 }}>
              <input type="hidden" name="groupId" value={g.id} />
              <div className="full"><label>Afegir equips (un per línia)</label><textarea name="text" rows={3} /></div>
              <div><button className="btn ghost">Afegir equips</button></div>
            </form>
            <form action={importCalendar} className="form" style={{ marginTop: 8 }}>
              <input type="hidden" name="groupId" value={g.id} />
              <div className="full"><label>Importar calendari (enganxa el text del PDF: línies "JORNADA 3 - 19 setembre 2026" i "Equip local - Equip visitant")</label><textarea name="text" rows={6} placeholder={"JORNADA 1 - 5 setembre 2026\nEsportiu Bonmatí - Bar Moreda\n..."} /></div>
              <div><button className="btn ghost">Importar calendari</button></div>
            </form>
          </details>
        ))}
      </div>
    </>
  );
}
