"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SampleChip } from "@/components/ui/chip";
import { usePreview } from "@/lib/preview-store";

/** Module page header: title, one-line purpose, sample notice and the module's primary (disabled) action. */
export function PageHeader({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  /** primary log action, disabled in Phase 0 */
  action?: string;
  /** extra controls on the right (e.g. a period switch) */
  children?: ReactNode;
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
        {state === "ready" && <SampleChip />}
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
