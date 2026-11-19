"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { SampleChip } from "@/components/ui/chip";
import { usePreview } from "@/lib/preview-store";

/**
 * One of the three Overview columns, each a time horizon:
 * Now (today) · Trends (weeks) · Progression (lifetime).
 */
export function Column({
  icon: Icon,
  title,
  description,
  className,
  bodyClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  /** layout of the modules; may use container-query variants (@md:, @4xl: …) */
  bodyClassName?: string;
  children: ReactNode;
}) {
  const { state } = usePreview();
  const id = `col-${title.toLowerCase()}`;
  return (
    <section
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-slab border border-edge bg-slab", className)}
    >
      <header className="flex items-center gap-3 border-b border-edge bg-well/40 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-well text-saffron">
          <Icon size={17} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="font-display text-[22px] leading-6 font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h2>
          <p className="truncate text-xs text-ink-3">{description}</p>
        </div>
        {state === "ready" && <SampleChip className="hidden sm:inline-flex" />}
      </header>
      <div className="@container flex flex-1 flex-col">
        <div className={cn("flex flex-1 flex-col", bodyClassName)}>{children}</div>
      </div>
    </section>
  );
}
