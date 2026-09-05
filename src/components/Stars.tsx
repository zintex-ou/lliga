/** 0–5 rating rendered as stars with fractional fill. */
export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  return (
    <span className="stars-wrap" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} / 5`}>
      <span className="stars-bg">★★★★★</span>
      <span className="stars-fg" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}
