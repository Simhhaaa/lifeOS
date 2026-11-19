"use client";

import { useId } from "react";

/**
 * Minimal area sparkline for one series with its own scale (small multiples).
 * Points are evenly spaced; `null` values are skipped and the line connects
 * across them. The last point is marked.
 */
export function Sparkline({
  values,
  color = "var(--sky)",
  height = 56,
  label,
}: {
  values: (number | null)[];
  color?: string;
  height?: number;
  label: string;
}) {
  const id = useId();
  const W = 200;
  const pts = values
    .map((v, i) => (v === null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p !== null);
  if (pts.length < 2) {
    return (
      <div className="grid place-items-center text-2xs text-ink-3" style={{ height }}>
        Not enough data
      </div>
    );
  }
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const pad = (max - min) * 0.2 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(2)} ${y(p.v).toFixed(2)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1].i)} ${height} L${x(pts[0].i)} ${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <div className="relative" style={{ height }}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span
        aria-hidden
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-well"
        style={{ left: `${(x(last.i) / W) * 100}%`, top: y(last.v), background: color }}
      />
    </div>
  );
}
