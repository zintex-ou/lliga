"use client";
export function PrintButton({ label }: { label: string }) { return <button className="btn sm" onClick={() => window.print()}>{label}</button>; }
