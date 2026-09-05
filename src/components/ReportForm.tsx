import { sendReport } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
export function ReportForm({ matchId, t }: { matchId: number; t: Dict }) {
  return (
    <details className="report"><summary>{t.reportError}</summary>
      <form action={sendReport} className="report-form">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} />
        <textarea name="message" rows={3} required minLength={5} placeholder={t.reportPh} />
        <input name="contact" placeholder={t.reportContact} />
        <button className="btn sm">{t.enviar}</button>
      </form>
    </details>
  );
}
