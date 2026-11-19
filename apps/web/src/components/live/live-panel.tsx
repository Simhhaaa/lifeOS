"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** A framed panel backed by the real API (same look as framed Modules, plus a "Live" marker). */
export function LivePanel({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = `live-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col rounded-slab border border-edge bg-slab px-5 py-5", className)}>
      <header className="mb-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 id={id} className="flex items-center gap-2 text-[15px] leading-5 font-semibold text-ink">
            {title}
            <LiveChip />
          </h3>
          {subtitle && <p className="mt-0.5 truncate text-xs text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="-mt-1 flex items-center gap-1">{actions}</div>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function LiveChip() {
  return (
    <span
      title="Your real data from the LIFEOS server"
      className="inline-flex h-5 items-center gap-1 rounded-full bg-mint-soft px-2 text-2xs font-medium text-mint"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-mint" />
      Live
    </span>
  );
}

/** Small inline notice for conflicts and failures inside a panel. */
export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "coral"; children: ReactNode }) {
  return (
    <p
      role="status"
      className={cn("rounded-ctl px-3 py-2 text-xs", tone === "coral" ? "bg-coral-soft text-coral" : "bg-well text-ink-2")}
    >
      {children}
    </p>
  );
}
