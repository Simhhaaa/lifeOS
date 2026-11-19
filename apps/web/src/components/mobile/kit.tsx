"use client";

import type { ReactNode } from "react";
import { House, Plus, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/components/ui/cn";

/**
 * Mobile design kit (Phase 0 design frames only).
 * The native app is built with Expo in Phase 4; these frames define its layout,
 * navigation and controls in the same design language as desktop.
 */

export type Tab = "home" | "log" | "progress" | "profile";

/** A 390 × 844 pt phone frame with a caption. Content scrolls inside the screen. */
export function Phone({
  n,
  title,
  caption,
  tab,
  children,
  overlay,
}: {
  n: number;
  title: string;
  caption: string;
  tab?: Tab;
  children: ReactNode;
  /** rendered above content and tab bar (sheets, dialogs) */
  overlay?: ReactNode;
}) {
  return (
    <figure className="flex w-[390px] shrink-0 flex-col gap-3">
      <figcaption className="px-1">
        <p className="flex items-baseline gap-2">
          <span className="num text-xs text-saffron">{String(n).padStart(2, "0")}</span>
          <span className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">{title}</span>
        </p>
        <p className="mt-0.5 min-h-10 text-xs text-ink-3">{caption}</p>
      </figcaption>
      <div className="rounded-[52px] border border-edge-strong bg-[#03090a] p-[9px] shadow-2xl shadow-black/60">
        <div className="relative h-[844px] overflow-hidden rounded-[44px] bg-base">
          {/* sensor housing; no fake clock or battery */}
          <div aria-hidden className="absolute top-2.5 left-1/2 z-30 h-[30px] w-[118px] -translate-x-1/2 rounded-full bg-black" />
          <div className="absolute inset-0 flex flex-col">
            <div className="h-[54px] shrink-0" aria-hidden />
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">{children}</div>
            {tab && <TabBar active={tab} />}
          </div>
          {overlay}
        </div>
      </div>
    </figure>
  );
}

const TABS: { key: Tab; label: string; icon: typeof House }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "log", label: "Log", icon: Plus },
  { key: "progress", label: "Progress", icon: Sparkles },
  { key: "profile", label: "Profile", icon: UserRound },
];

/** Bottom navigation: four destinations (spec §2.4). Log is the primary action. */
export function TabBar({ active }: { active: Tab }) {
  return (
    <nav aria-label="Mobile navigation" className="shrink-0 border-t border-edge bg-slab/95 px-3 pt-2 pb-7 backdrop-blur">
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key} className="flex flex-col items-center gap-1">
              {t.key === "log" ? (
                <span className={cn("grid h-11 w-11 place-items-center rounded-full bg-saffron text-saffron-ink", on && "ring-4 ring-saffron/25")}>
                  <t.icon size={22} strokeWidth={2.5} aria-hidden />
                </span>
              ) : (
                <span className={cn("grid h-11 w-11 place-items-center rounded-full", on ? "bg-well text-ink" : "text-ink-3")}>
                  <t.icon size={21} strokeWidth={on ? 2.2 : 1.75} aria-hidden />
                </span>
              )}
              <span className={cn("text-[11px]", on ? "text-ink" : "text-ink-3")}>{t.label}</span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Screen title row. */
export function ScreenHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end gap-3 px-5 pt-2 pb-4">
      <div className="min-w-0 flex-1">
        {sub && <p className="text-[13px] text-ink-3">{sub}</p>}
        <h2 className="font-display text-[30px] leading-[1.05] font-semibold tracking-[-0.035em] text-ink">{title}</h2>
      </div>
      {right}
    </header>
  );
}

/** Rounded card used on mobile. */
export function MCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mx-4 rounded-[20px] border border-edge bg-slab p-4", className)}>{children}</section>;
}

export function MLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <p className="mb-2.5 flex items-baseline justify-between text-[13px] font-medium text-ink-2">
      {children}
      {right && <span className="text-xs font-normal text-ink-3">{right}</span>}
    </p>
  );
}

/** − value + stepper with 44 pt touch targets. */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format: (v: number) => ReactNode;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => set(value - step)}
        aria-label={`Decrease ${label}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-well text-xl text-ink active:bg-well-strong"
      >
        −
      </button>
      <output aria-live="polite" className="num min-w-0 flex-1 text-center text-[22px] text-ink">
        {format(value)}
      </output>
      <button
        type="button"
        onClick={() => set(value + step)}
        aria-label={`Increase ${label}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-well text-xl text-ink active:bg-well-strong"
      >
        +
      </button>
    </div>
  );
}

/** 1–5 rating as five 44 pt buttons. */
export function Scale5({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  low: string;
  high: string;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "num h-11 rounded-[12px] text-[15px] transition",
              value === v ? "bg-ink text-base" : "bg-well text-ink-2 active:bg-well-strong",
            )}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </div>
  );
}

/** Full-width primary button pinned at the bottom of a flow. */
export function PrimaryBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-4 border-t border-edge bg-base/95 px-4 pt-3 pb-8 backdrop-blur">
      <button type="button" className="h-[52px] w-full rounded-full bg-saffron text-[16px] font-semibold text-saffron-ink active:brightness-110">
        {children}
      </button>
      {note && <p className="mt-2 text-center text-[11px] text-ink-3">{note}</p>}
    </div>
  );
}

/** Flow header with back/close and a step title. */
export function FlowHeader({ title, sub, action = "Cancel" }: { title: string; sub?: string; action?: string }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-1 pb-3">
      <button type="button" className="h-11 px-1 text-[15px] text-ink-2">
        {action}
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[16px] font-semibold text-ink">{title}</p>
        {sub && <p className="truncate text-[12px] text-ink-3">{sub}</p>}
      </div>
      <span className="w-[52px]" aria-hidden />
    </header>
  );
}
