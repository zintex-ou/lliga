"use client";
import { useEffect, useState } from "react";

/** Site-wide announcement popup (holiday greetings, champions photo…). Dismissal is remembered per version in localStorage. */
export function Popup({ id, title, body, image, closeLabel }: { id: string; title: string; body: string; image: string | null; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("popup-dismissed") !== id) setOpen(true); } catch { setOpen(true); }
  }, [id]);
  const close = () => { setOpen(false); try { localStorage.setItem("popup-dismissed", id); } catch {} };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <div className="popup-bg" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="popup" role="dialog" aria-modal="true" aria-label={title}>
        <button className="popup-x" onClick={close} aria-label={closeLabel}>×</button>
        {image && <img src={`/uploads/${image}`} alt="" />}
        <div className="popup-body">
          {title && <h2>{title}</h2>}
          {body && <p>{body}</p>}
          <button className="btn" onClick={close}>{closeLabel}</button>
        </div>
      </div>
    </div>
  );
}
