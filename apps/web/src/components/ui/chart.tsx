"use client";

import type { ReactNode } from "react";

/** Recharts axis defaults for the Petrol & Saffron theme. */
export const AXIS = {
  stroke: "var(--edge-strong)",
  tick: { fill: "var(--ink-3)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID = { vertical: false, stroke: "var(--grid)" } as const;

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-2xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="w-3.5 border-t-[1.5px] border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

interface TipRow {
  name?: string | number;
  value?: number | string | readonly (string | number)[] | null;
  color?: string;
  dataKey?: string | number | ((o: unknown) => unknown);
}

/** Tooltip body for Recharts `content`. */
export function ChartTip({
  active,
  label,
  rows,
  format,
}: {
  active?: boolean;
  label?: ReactNode;
  rows?: readonly TipRow[];
  format: (v: number, name: string) => string;
}) {
  if (!active || !rows?.length) return null;
  return (
    <div className="rounded-ctl border border-edge-strong bg-slab px-3 py-2 text-xs shadow-xl shadow-black/50">
      {label !== undefined && <p className="mb-1 text-2xs text-ink-3">{label}</p>}
      {rows
        .filter((r) => r.value !== null && r.value !== undefined)
        .map((r, i) => (
          <p key={i} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-ink-2">
              {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
              {r.name}
            </span>
            <span className="num text-ink">{format(Number(r.value), String(r.name))}</span>
          </p>
        ))}
    </div>
  );
}
