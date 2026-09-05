"use client";
import { useEffect } from "react";
/** Replaces the HOST placeholder in webcal:// links with the real host (server doesn't know it reliably behind proxies). */
export function WebcalFix() {
  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>("a[data-webcal]").forEach((a) => { a.href = a.getAttribute("href")!.replace("HOST", location.host); });
  });
  return null;
}
