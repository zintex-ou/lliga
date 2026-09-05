"use client";
import { useMemo, useState, useTransition } from "react";
import { saveActa } from "@/lib/actions";

export type SquadPlayer = { id: number; label: string; position: string; suspended: boolean };
type TeamIn = { id: number; name: string; squad: SquadPlayer[] };
type App = { playerId: number; role: "titular" | "suplent"; entered: boolean; conceded: number | null };
type Ev = { playerId: number; type: string; minute: number | null; assistId: number | null; sanctionMatches?: number | null; sanctionReason?: string | null };
type MatchIn = { id: number; status: "played" | "scheduled" | "postponed" | "walkover"; homeGoals: number | null; awayGoals: number | null; date: string | null; time: string | null; field: string; referee: string | null; refereeId?: number | null; notes: string | null; roundDate: string; published?: boolean };

const REASONS: [string, string][] = [["falta_joc", "Falta de joc"], ["joc_violent", "Joc violent"], ["antiesportiva", "Conducta antiesportiva"], ["agressio", "Agressió / baralla"], ["comite", "Decisió del comitè"]];
const CARD_TYPES: [string, string][] = [["groga", "🟨 Groga"], ["segona_groga", "🟨🟨 Segona groga"], ["vermella", "🟥 Vermella directa"]];

export function ActaEditor({ match, home, away, apps: apps0, events: events0, sanctions, assistsEnabled, fields = [], referees = [] }: {
  match: MatchIn; home: TeamIn; away: TeamIn; apps: App[]; events: Ev[]; sanctions: { eventPlayerId: number; matches: number; reason: string }[]; assistsEnabled: boolean; fields?: string[]; referees?: { id: number; name: string }[];
}) {
  const [status, setStatus] = useState<MatchIn["status"]>(match.status);
  const [hg, setHg] = useState<string>(match.homeGoals?.toString() ?? "");
  const [ag, setAg] = useState<string>(match.awayGoals?.toString() ?? "");
  const [date, setDate] = useState(match.date ?? match.roundDate);
  const [time, setTime] = useState(match.time ?? "");
  const [field, setField] = useState(match.field ?? "");
  const [referee, setReferee] = useState(match.referee ?? "");
  const [refereeId, setRefereeId] = useState<number | null>(match.refereeId ?? null);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [apps, setApps] = useState<App[]>(apps0);
  const [goals, setGoals] = useState<Ev[]>(events0.filter((e) => e.type === "gol" || e.type === "gol_pen"));
  const [cards, setCards] = useState<Ev[]>(events0.filter((e) => e.type !== "gol" && e.type !== "gol_pen").map((e) => {
    const s = sanctions.find((x) => x.eventPlayerId === e.playerId);
    return { ...e, sanctionMatches: s?.matches ?? (e.type === "groga" ? null : 1), sanctionReason: s?.reason ?? (e.type === "segona_groga" ? "antiesportiva" : "falta_joc") };
  }));
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const all = useMemo(() => new Map([...home.squad, ...away.squad].map((p) => [p.id, p])), [home, away]);
  const teamOf = (pid: number) => (home.squad.some((p) => p.id === pid) ? home.id : away.id);
  const inActa = (teamId: number) => apps.filter((a) => teamOf(a.playerId) === teamId).map((a) => all.get(a.playerId)!).filter(Boolean);
  const presentIds = new Set(apps.map((a) => a.playerId));

  const addApp = (pid: number, role: "titular" | "suplent") => { if (!pid || presentIds.has(pid)) return; setApps([...apps, { playerId: pid, role, entered: role === "titular", conceded: null }]); };
  const removeApp = (pid: number) => { setApps(apps.filter((a) => a.playerId !== pid)); setGoals(goals.filter((g) => g.playerId !== pid).map((g) => (g.assistId === pid ? { ...g, assistId: null } : g))); setCards(cards.filter((c) => c.playerId !== pid)); };
  const patchApp = (pid: number, patch: Partial<App>) => setApps(apps.map((a) => (a.playerId === pid ? { ...a, ...patch } : a)));

  // auto goalkeeper conceded: if exactly one GK entered per team, conceded = opponent goals
  const autoConceded = () => {
    const h = Number(hg), a = Number(ag);
    if (!Number.isFinite(h) || !Number.isFinite(a)) return;
    setApps(apps.map((x) => {
      const p = all.get(x.playerId); if (!p || p.position !== "POR" || !x.entered) return x;
      const team = teamOf(x.playerId);
      const gks = apps.filter((y) => y.entered && all.get(y.playerId)?.position === "POR" && teamOf(y.playerId) === team);
      return gks.length === 1 ? { ...x, conceded: team === home.id ? a : h } : x;
    }));
  };

  const goalsByTeam = (teamId: number) => goals.filter((g) => teamOf(g.playerId) === teamId).length;
  const mismatch = status === "played" && hg !== "" && ag !== "" && (goalsByTeam(home.id) !== Number(hg) || goalsByTeam(away.id) !== Number(ag)) && goals.length > 0;

  const submit = (publish = true) => {
    setMsg(null);
    if (status === "played" && (hg === "" || ag === "")) { setMsg({ text: "Cal indicar el resultat." }); return; }
    start(async () => {
      const r = await saveActa({
        matchId: match.id, status, homeGoals: hg === "" ? null : Number(hg), awayGoals: ag === "" ? null : Number(ag), date, time, field, referee, refereeId, notes, publish,
        apps, events: [...goals, ...cards].map((e) => ({ ...e, minute: e.minute ?? null })),
      });
      setMsg(r && "error" in r ? { text: r.error! } : { ok: true, text: publish ? "Acta publicada. Classificació i estadístiques actualitzades." : "Acta desada com a esborrany (no es veu al web fins que es publiqui)." });
    });
  };

  const Squad = ({ team }: { team: TeamIn }) => {
    const tit = apps.filter((a) => a.role === "titular" && teamOf(a.playerId) === team.id);
    const sup = apps.filter((a) => a.role === "suplent" && teamOf(a.playerId) === team.id);
    const avail = team.squad.filter((p) => !presentIds.has(p.id));
    const Sel = ({ role }: { role: "titular" | "suplent" }) => (
      <select value="" onChange={(e) => addApp(Number(e.target.value), role)} disabled={role === "titular" && tit.length >= 11}>
        <option value="">+ {role === "titular" ? `titular (${tit.length}/11)` : `suplent (${sup.length})`}…</option>
        {avail.map((p) => <option key={p.id} value={p.id} disabled={p.suspended}>{p.label}{p.position === "POR" ? " (POR)" : ""}{p.suspended ? " — SANCIONAT" : ""}</option>)}
      </select>
    );
    return (
      <div className="box">
        <h3>{team.name}</h3>
        <label className="lbl">Titulars</label>
        <div className="chips">{tit.map((a) => { const p = all.get(a.playerId)!; return (
          <span key={a.playerId} className="chip">{p.label}{p.position === "POR" && <label>enc.<input type="number" min={0} className="w4" style={{ width: 44, padding: "1px 3px" }} value={a.conceded ?? ""} onChange={(e) => patchApp(a.playerId, { conceded: e.target.value === "" ? null : Number(e.target.value) })} /></label>}<button type="button" onClick={() => removeApp(a.playerId)} aria-label="treure">×</button></span>
        ); })}</div>
        <Sel role="titular" />
        <label className="lbl" style={{ marginTop: 10 }}>Suplents presents</label>
        <div className="chips">{sup.map((a) => { const p = all.get(a.playerId)!; return (
          <span key={a.playerId} className="chip sup">{p.label}<label title="Ha entrat al camp"><input type="checkbox" checked={a.entered} onChange={(e) => patchApp(a.playerId, { entered: e.target.checked })} />juga</label>{p.position === "POR" && a.entered && <label>enc.<input type="number" min={0} style={{ width: 44, padding: "1px 3px" }} value={a.conceded ?? ""} onChange={(e) => patchApp(a.playerId, { conceded: e.target.value === "" ? null : Number(e.target.value) })} /></label>}<button type="button" onClick={() => removeApp(a.playerId)} aria-label="treure">×</button></span>
        ); })}</div>
        <Sel role="suplent" />
      </div>
    );
  };

  const playersInActa = [...inActa(home.id), ...inActa(away.id)];
  const PlayerSel = ({ value, onChange, allowEmpty }: { value: number | null; onChange: (v: number | null) => void; allowEmpty?: boolean }) => (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
      {allowEmpty && <option value="">—</option>}
      {!allowEmpty && value == null && <option value="">tria…</option>}
      <optgroup label={home.name}>{inActa(home.id).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
      <optgroup label={away.name}>{inActa(away.id).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
    </select>
  );

  return (
    <div>
      <div className="box">
        <div className="form">
          <div><label>Estat</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as MatchIn["status"])}>
              <option value="scheduled">Pendent</option><option value="played">Jugat</option><option value="postponed">Ajornat</option><option value="walkover">No presentat (resultat oficial)</option>
            </select></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "end" }}>
            <div><label>{home.name}</label><input type="number" min={0} value={hg} onChange={(e) => setHg(e.target.value)} onBlur={autoConceded} /></div>
            <b style={{ paddingBottom: 8 }}>–</b>
            <div><label>{away.name}</label><input type="number" min={0} value={ag} onChange={(e) => setAg(e.target.value)} onBlur={autoConceded} /></div>
          </div>
          <div><label>Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label>Hora</label><input list="acta-times" placeholder="hh:mm" value={time} onChange={(e) => setTime(e.target.value)} /><datalist id="acta-times">{["16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"].map((x) => <option key={x} value={x} />)}</datalist></div>
          <div><label>Camp</label><input list="acta-fields" value={field} onChange={(e) => setField(e.target.value)} /><datalist id="acta-fields">{fields.map((x) => <option key={x} value={x} />)}</datalist></div>
          <div><label>Àrbitre</label>{referees.length ? <select value={refereeId ?? ""} onChange={(e) => setRefereeId(e.target.value ? Number(e.target.value) : null)}><option value="">— (o escriu-lo a sota)</option>{referees.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : null}<input value={referee} onChange={(e) => setReferee(e.target.value)} placeholder="Àrbitre (text lliure)" style={referees.length ? { marginTop: 6 } : undefined} /></div>
          <div className="full"><label>Observacions</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
      </div>

      {status === "played" && (
        <>
          <div className="acta-grid" style={{ marginTop: 14 }}>
            <Squad team={home} /><Squad team={away} />
          </div>
          <div className="acta-grid" style={{ marginTop: 14 }}>
            <div className="box">
              <h3>Gols</h3>
              <table className="mini"><thead><tr><th>Min</th><th>Jugador</th><th className="c">Penal</th>{assistsEnabled && <th>Assistència</th>}<th></th></tr></thead>
                <tbody>{goals.map((g, i) => (
                  <tr key={i}>
                    <td><input type="number" min={1} max={120} className="w4" value={g.minute ?? ""} onChange={(e) => setGoals(goals.map((x, k) => (k === i ? { ...x, minute: e.target.value === "" ? null : Number(e.target.value) } : x)))} /></td>
                    <td><PlayerSel value={g.playerId || null} onChange={(v) => setGoals(goals.map((x, k) => (k === i ? { ...x, playerId: v ?? 0 } : x)))} /></td>
                    <td className="c"><input type="checkbox" checked={g.type === "gol_pen"} onChange={(e) => setGoals(goals.map((x, k) => (k === i ? { ...x, type: e.target.checked ? "gol_pen" : "gol" } : x)))} /></td>
                    {assistsEnabled && <td><PlayerSel allowEmpty value={g.assistId} onChange={(v) => setGoals(goals.map((x, k) => (k === i ? { ...x, assistId: v } : x)))} /></td>}
                    <td><button type="button" className="btn ghost sm" onClick={() => setGoals(goals.filter((_, k) => k !== i))}>×</button></td>
                  </tr>))}</tbody></table>
              <div className="actions"><button type="button" className="btn ghost sm" disabled={!playersInActa.length} onClick={() => setGoals([...goals, { playerId: 0, type: "gol", minute: null, assistId: null }])}>+ gol</button>
                {mismatch && <span className="msg err" style={{ margin: 0 }}>El nombre de gols no coincideix amb el resultat ({goalsByTeam(home.id)}–{goalsByTeam(away.id)}).</span>}</div>
            </div>
            <div className="box">
              <h3>Targetes</h3>
              <table className="mini"><thead><tr><th>Min</th><th>Jugador</th><th>Tipus</th><th>Sanció</th><th>Motiu</th><th></th></tr></thead>
                <tbody>{cards.map((c, i) => {
                  const red = c.type !== "groga";
                  return (
                    <tr key={i}>
                      <td><input type="number" min={1} max={120} className="w4" value={c.minute ?? ""} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, minute: e.target.value === "" ? null : Number(e.target.value) } : x)))} /></td>
                      <td><PlayerSel value={c.playerId || null} onChange={(v) => setCards(cards.map((x, k) => (k === i ? { ...x, playerId: v ?? 0 } : x)))} /></td>
                      <td><select value={c.type} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, type: e.target.value, sanctionMatches: e.target.value === "groga" ? null : (x.sanctionMatches ?? 1), sanctionReason: e.target.value === "segona_groga" ? "antiesportiva" : x.sanctionReason } : x)))}>{CARD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                      <td>{red ? <span style={{ whiteSpace: "nowrap" }}><input type="number" min={0} max={99} className="w4" value={c.sanctionMatches ?? 1} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, sanctionMatches: Number(e.target.value) } : x)))} /> partits</span> : <span className="gk">auto</span>}</td>
                      <td>{red ? <select value={c.sanctionReason ?? "falta_joc"} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, sanctionReason: e.target.value } : x)))}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : "—"}</td>
                      <td><button type="button" className="btn ghost sm" onClick={() => setCards(cards.filter((_, k) => k !== i))}>×</button></td>
                    </tr>
                  );
                })}</tbody></table>
              <div className="actions"><button type="button" className="btn ghost sm" disabled={!playersInActa.length} onClick={() => setCards([...cards, { playerId: 0, type: "groga", minute: null, assistId: null, sanctionMatches: null, sanctionReason: "falta_joc" }])}>+ targeta</button></div>
              <p className="gk" style={{ marginBottom: 0 }}>Les grogues s'acumulen automàticament (la sanció salta cada N grogues, N a Configuració). Per a vermella / segona groga indica els partits de sanció i el motiu.</p>
            </div>
          </div>
        </>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={() => submit(true)} disabled={pending}>{pending ? "Desant…" : "Publicar acta"}</button>
        {status === "played" && <button type="button" className="btn ghost" onClick={() => submit(false)} disabled={pending}>Desar com a esborrany</button>}
        {match.published === false && <span className="tag" style={{ background: "var(--gold-soft)", color: "#7a5e00" }}>Esborrany · no publicat</span>}
        {msg && <span className={"msg " + (msg.ok ? "ok" : "err")} style={{ margin: 0 }}>{msg.text}</span>}
      </div>
    </div>
  );
}
