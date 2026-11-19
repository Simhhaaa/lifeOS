"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreview } from "@/lib/preview-store";
import type { World } from "@/lib/world";

export interface Stat {
  label: string;
  value: string;
  unit?: string;
  /** comparison or context line; units and window */
  note?: ReactNode;
  accent?: boolean;
}

/** Headline figures for a module page, one slab divided into equal cells. */
export function StatStrip({
  labels,
  stats,
  className,
}: {
  /** shown while loading, empty or in error, so the strip keeps its meaning */
  labels: string[];
  stats: (w: World) => Stat[];
  className?: string;
}) {
  const { data, state } = usePreview();
  const ready = state === "ready" && data !== null;
  const items: (Stat | null)[] = ready ? stats(data) : labels.map(() => null);
  return (
    <section
      aria-label="Key figures"
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-slab border border-edge bg-edge lg:grid-cols-4",
        className,
      )}
    >
      {items.map((s, i) => (
        <div key={i} className="min-w-0 bg-slab px-5 py-4">
          {s ? (
            <>
              <p className="truncate text-xs text-ink-3">{s.label}</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-display text-[30px] leading-8 font-semibold tracking-[-0.03em]",
                    s.accent ? "text-saffron" : "text-ink",
                  )}
                >
                  {s.value}
                </span>
                {s.unit && <span className="text-sm text-ink-3">{s.unit}</span>}
              </p>
              {s.note && <p className="num mt-0.5 truncate text-2xs text-ink-3">{s.note}</p>}
            </>
          ) : (
            <>
              <p className="truncate text-xs text-ink-3">{labels[i]}</p>
              {state === "loading" || state === "ready" ? (
                <Skeleton className="mt-2 h-6 w-16 rounded-ctl" />
              ) : (
                <>
                  <p className="font-display text-[30px] leading-8 font-semibold text-ink-3">—</p>
                  <p className="mt-0.5 text-2xs text-ink-3">{state === "error" ? "Couldn’t load" : "No data yet"}</p>
                </>
              )}
            </>
          )}
        </div>
      ))}
    </section>
  );
}

/** "+12% vs prior 14 days" style comparison, coloured by direction. */
export function Change({
  now,
  prev,
  suffix,
  invert = false,
  mode = "pct",
  decimals = 0,
}: {
  now: number | null;
  prev: number | null;
  suffix: string;
  /** lower is better (e.g. screen time) */
  invert?: boolean;
  mode?: "pct" | "abs";
  decimals?: number;
}) {
  if (now === null || prev === null || (mode === "pct" && prev === 0)) return <span>no prior data</span>;
  const v = mode === "pct" ? Math.round(((now - prev) / prev) * 100) : now - prev;
  const good = invert ? v < 0 : v > 0;
  const bad = invert ? v > 0 : v < 0;
  return (
    <span>
      <span className={good ? "text-mint" : bad ? "text-coral" : ""}>
        {v > 0 ? "+" : ""}
        {mode === "pct" ? `${v}%` : v.toFixed(decimals)}
      </span>{" "}
      {suffix}
    </span>
  );
}
