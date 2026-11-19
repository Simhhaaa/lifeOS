import { cn } from "./cn";

type Tone = "saffron" | "sky" | "mint" | "coral" | "ink";

const FILL: Record<Tone, string> = {
  saffron: "bg-saffron",
  sky: "bg-sky",
  mint: "bg-mint",
  coral: "bg-coral",
  ink: "bg-ink-3",
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Rounded progress bar. `value` 0–1. Always shown next to a text value. */
export function Bar({
  value,
  label,
  tone = "saffron",
  size = "md",
  className,
}: {
  value: number;
  label: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = clamp01(value) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "w-full overflow-hidden rounded-full bg-well",
        size === "sm" ? "h-1" : size === "md" ? "h-1.5" : "h-2.5",
        className,
      )}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One dot per unit, for small countable targets (e.g. 2 of 4 sessions). */
export function Pips({
  current,
  target,
  label,
  tone = "saffron",
  size = "md",
}: {
  current: number;
  target: number;
  label: string;
  tone?: Tone;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(current, target)}
      className="flex items-center gap-1"
    >
      {Array.from({ length: target }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "shrink-0 rounded-full",
            size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
            i < current ? FILL[tone] : "border border-edge-strong",
          )}
        />
      ))}
    </div>
  );
}

/** Small circular progress ring (SVG). */
export function Ring({ value, size = 28, stroke = 3, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className="-rotate-90"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--well-strong)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--saffron)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${clamp01(value) * c} ${c}`}
      />
    </svg>
  );
}
