"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function Hit() {
  const path = usePathname();
  useEffect(() => { try { const body = JSON.stringify({ path }); if (navigator.sendBeacon) navigator.sendBeacon("/api/hit", new Blob([body], { type: "application/json" })); else fetch("/api/hit", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }); } catch {} }, [path]);
  return null;
}
