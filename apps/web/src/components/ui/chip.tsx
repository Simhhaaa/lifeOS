import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "saffron" | "sky" | "mint" | "coral";

const tones: Record<Tone, string> = {
  neutral: "bg-well text-ink-2",
  saffron: "bg-saffron-soft text-saffron",
  sky: "bg-sky-soft text-sky",
  mint: "bg-mint-soft text-mint",
  coral: "bg-coral-soft text-coral",
};

/** Small pill label. Tones always carry text, never colour alone. */
export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-2xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Marks generated sample data. Shown on every data region in Phase 0. */
export function SampleChip({ className }: { className?: string }) {
  return (
    <span
      title="Generated sample data for design review — not real activity"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-edge-strong px-2.5 text-2xs whitespace-nowrap text-ink-3",
        className,
      )}
    >
      <span aria-hidden className="hatch h-2.5 w-2.5 rounded-full text-ink-3" />
      Sample data
    </span>
  );
}
