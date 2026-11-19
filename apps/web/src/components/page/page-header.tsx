"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SampleChip } from "@/components/ui/chip";
import { usePreview } from "@/lib/preview-store";
import { LiveChip } from "@/components/live/live-panel";

/** Module page header: title, one-line purpose, sample notice and the module's primary (disabled) action. */
export function PageHeader({
  title,
  description,
  action,
  children,
  live,
}: {
  title: string;
  description: string;
  /** primary log action, disabled in Phase 0 */
  action?: string;
  /** extra controls on the right (e.g. a period switch) */
  children?: ReactNode;
  /** names of panels that show real data; the rest of the page is sample data */
  live?: string[];
}) {
  const { state } = usePreview();
  return (
    <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-ink">
          {title}
          <span className="text-saffron">.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink-2">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {live?.length ? (
          <span className="flex items-center gap-2">
            <LiveChip />
            <span className="text-2xs text-ink-3">{live.join(", ")} · other panels are sample data</span>
          </span>
        ) : (
          state === "ready" && <SampleChip />
        )}
        {action && (
          <Button variant="primary" disabled title="Logging flows are designed after the screens are approved">
            <Plus size={15} strokeWidth={2.5} aria-hidden />
            {action}
          </Button>
        )}
      </div>
    </header>
  );
}
