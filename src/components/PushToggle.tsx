"use client";
import { useEffect, useState } from "react";

/** "Notify me" button: subscribes this browser to push for a team (or a group / everything). */
export function PushToggle({ team, group, labelOn, labelOff, unsupported, lang }: { team?: string; group?: string; labelOn: string; labelOff: string; unsupported: string; lang: string }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "off" | "on" | "busy">("unknown");
  const scope = team ? `team:${team}` : group ? `group:${group}` : "all";
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setState("unsupported"); return; }
    try { setState(localStorage.getItem("push:" + scope) === "1" && Notification.permission === "granted" ? "on" : "off"); } catch { setState("off"); }
  }, [scope]);
  const toggle = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
      if (state === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), unsubscribe: true }) }); await sub.unsubscribe(); }
        try { localStorage.removeItem("push:" + scope); } catch {}
        setState("off"); return;
      }
      const perm = await Notification.requestPermission(); if (perm !== "granted") { setState("off"); return; }
      const { key } = await fetch("/api/push").then((r) => r.json());
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), team, group, lang }) });
      try { localStorage.setItem("push:" + scope, "1"); } catch {}
      setState("on");
    } catch (e) { console.error(e); setState("off"); }
  };
  if (state === "unknown") return null;
  if (state === "unsupported") return <span className="gk" title={unsupported}>🔕 {unsupported}</span>;
  return <button type="button" className={"btn sm " + (state === "on" ? "" : "ghost")} onClick={toggle} disabled={state === "busy"}>{state === "on" ? `🔔 ${labelOn}` : `🔕 ${labelOff}`}</button>;
}
function urlBase64ToUint8Array(b64: string) { const pad = "=".repeat((4 - (b64.length % 4)) % 4); const base = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(base); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); }
