"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { usePreview } from "@/lib/preview-store";
import type { World } from "@/lib/world";

export interface ModuleProps {
  title: string;
  /** units and time window, e.g. "Last 14 days · hours per day" */
  subtitle?: string;
  /** full module page */
  href?: string;
  className?: string;
  /** grow to fill leftover column height (charts) */
  grow?: boolean;
  /** standalone panel (module pages) instead of a section inside a column */
  framed?: boolean;
  actions?: (data: World) => ReactNode;
  skeleton?: { rows?: number; block?: boolean };
  empty: { icon: LucideIcon; title: string; description: string; action?: string };
  children: (data: World) => ReactNode;
}

/**
 * A section inside a column. Separated by a hairline from the one above;
 * renders loading / empty / error / ready consistently.
 */
export function Module({ title, subtitle, href, className, grow, framed, actions, skeleton, empty, children }: ModuleProps) {
  const { data, state, retry } = usePreview();
  const ready = state === "ready" && data !== null;
  const id = `m-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 flex-col px-5 py-5",
        framed ? "rounded-slab border border-edge bg-slab" : "border-t border-edge first:border-t-0",
        grow && "flex-1",
        className,
      )}
    >
      <header className="mb-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 id={id} className="text-[15px] leading-5 font-semibold text-ink">
            {href ? (
              <Link href={href} className="group inline-flex items-center gap-1 hover:text-saffron">
                {title}
                <ArrowUpRight
                  size={14}
                  strokeWidth={2}
                  className="text-ink-3 transition group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-saffron"
                  aria-hidden
                />
              </Link>
            ) : (
              title
            )}
          </h3>
          {subtitle && <p className="mt-0.5 truncate text-xs text-ink-3">{subtitle}</p>}
        </div>
        {ready && actions ? <div className="-mt-1 -mr-1 flex items-center">{actions(data)}</div> : null}
      </header>
      <div className={cn("flex min-h-0 flex-col", grow && "flex-1")}>
        {state === "loading" || (state === "ready" && !data) ? (
          <SkeletonRows rows={skeleton?.rows ?? 3} block={skeleton?.block} />
        ) : state === "error" ? (
          <ErrorState what={title.toLowerCase()} onRetry={retry} />
        ) : state === "empty" ? (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
            action={
              empty.action ? (
                <Button size="sm" variant="secondary" disabled title="Logging is designed after Phase 0 approval">
                  {empty.action}
                </Button>
              ) : undefined
            }
          />
        ) : (
          children(data as World)
        )}
      </div>
    </section>
  );
}
