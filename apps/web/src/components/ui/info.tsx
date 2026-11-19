"use client";

import type { ReactNode } from "react";
import { Popover, Tooltip as RTooltip } from "radix-ui";
import { CircleHelp } from "lucide-react";

/** Click/keyboard-accessible explanation of how a number is calculated. */
export function MethodInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Method: ${label}`}
        className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-well hover:text-ink-2"
      >
        <CircleHelp size={15} strokeWidth={1.75} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-80 animate-fade-in rounded-box border border-edge-strong bg-slab p-4 text-xs leading-5 text-ink-2 shadow-2xl shadow-black/60"
        >
          <p className="mb-1.5 font-display text-sm font-semibold text-ink">
            Method <span className="font-normal text-ink-3">· {label}</span>
          </p>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-72 animate-fade-in rounded-ctl border border-edge-strong bg-slab px-2.5 py-1.5 text-xs text-ink shadow-xl shadow-black/50"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
