"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/components/ui/cn";
import { SampleChip } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { formatLongDate, greeting, isoWeek } from "@/lib/dates";
import { PREVIEW_STATES, usePreview } from "@/lib/preview-store";
import { PROFILE_XP_SCALE } from "@/lib/progression";
import type { DashboardData } from "@/lib/types";
import { LevelPath } from "./level-path";

/** One sentence built only from the data on this page. */
function statusLine(d: DashboardData): string {
  const open = d.tasks.filter((t) => !t.done).length;
  const readiness = d.readiness.result
    ? `readiness is ${d.readiness.result.level.toLowerCase()}`
    : "today’s check-in is incomplete";
  return `${open} of ${d.tasks.length} planned items still open, and ${readiness}.`;
}

function PreviewBar() {
  const { forced, setForced } = usePreview();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-box border border-dashed border-edge-strong px-3.5 py-2.5">
      <p className="flex items-center gap-2 text-xs text-ink-2">
        <span aria-hidden className="hatch h-3 w-3 shrink-0 rounded-full text-ink-3" />
        <span>
          <span className="font-medium text-ink">Design preview.</span> Generated sample data, nothing saved, dates
          relative to today.
        </span>
      </p>
      <div className="flex items-center gap-2">
        <span id="state-label" className="text-2xs whitespace-nowrap text-ink-3">
          Preview state
        </span>
        <ToggleGroup.Root
          type="single"
          value={forced}
          onValueChange={(v) => v && setForced(v as typeof forced)}
          aria-labelledby="state-label"
          className="flex rounded-full bg-well p-0.5"
        >
          {PREVIEW_STATES.map((s) => (
            <ToggleGroup.Item
              key={s}
              value={s}
              className="h-6 rounded-full px-2.5 text-2xs text-ink-3 capitalize transition hover:text-ink data-[state=on]:bg-ink data-[state=on]:text-base"
            >
              {s}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>
    </div>
  );
}

function LevelPanel() {
  const { data, state, retry } = usePreview();
  const shell = "relative overflow-hidden rounded-slab border border-edge bg-slab p-5 md:p-6";

  if (state === "loading" || (state === "ready" && !data)) {
    return (
      <div className={shell}>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-4 h-12 w-40 rounded-box" />
        <Skeleton className="mt-8 h-2 w-full" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className={shell}>
        <ErrorState what="level and XP" onRetry={retry} />
      </div>
    );
  }
  if (state === "empty" || !data) {
    return (
      <div className={shell}>
        <p className="text-xs text-ink-3">Profile level</p>
        <p className="mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.04em] text-ink-3">Lv 1</p>
        <p className="mt-3 max-w-md text-sm text-ink-2">
          0 XP. The server awards XP for validated activity. Log a study session, workout or daily check-in to start
          your level path.
        </p>
      </div>
    );
  }

  const p = data.profile.progress;
  const { weekXp, prevWeekXpSameDays: prev } = data.profile;
  const pct = prev > 0 ? Math.round(((weekXp - prev) / prev) * 100) : null;
  return (
    <div className={shell}>
      {/* soft saffron light in the corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-saffron/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start gap-x-8 gap-y-4">
        <div>
          <p className="flex items-center gap-1 text-xs text-ink-3">
            Profile level
            <MethodInfo label="level">
              Level comes from lifetime XP, which only the server awards for validated activity, so it never goes
              down. Reaching level L takes {PROFILE_XP_SCALE} × (L − 1)^1.8 XP in total, rounded to 10. Current
              performance is shown separately as form and attributes.
            </MethodInfo>
          </p>
          <p className="flex items-baseline gap-3">
            <span className="font-display text-[64px] leading-[0.9] font-semibold tracking-[-0.05em] text-ink">
              {p.level}
            </span>
            <span className="num text-sm text-ink-2">
              {(p.xp - p.currentLevelXp).toLocaleString()} / {(p.nextLevelXp - p.currentLevelXp).toLocaleString()} XP
            </span>
          </p>
        </div>
        <div className="flex gap-6 sm:ml-auto">
          <div>
            <p className="text-xs text-ink-3">This week</p>
            <p className="num mt-1 text-[22px] leading-7 text-saffron">+{weekXp.toLocaleString()}</p>
            <p className="text-2xs text-ink-3">
              vs <span className="num">{prev.toLocaleString()}</span> by now last week
              {pct !== null && (
                <span className={cn("num ml-1", pct > 0 ? "text-mint" : pct < 0 ? "text-coral" : "")}>
                  {pct > 0 ? "+" : ""}
                  {pct}%
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-3">To level {p.level + 1}</p>
            <p className="num mt-1 text-[22px] leading-7 text-ink">{p.toNext.toLocaleString()}</p>
            <p className="text-2xs text-ink-3">XP remaining</p>
          </div>
        </div>
      </div>
      <div className="relative mt-5">
        <LevelPath xp={p.xp} level={p.level} />
      </div>
      <SampleChip className="absolute right-5 bottom-5 hidden md:inline-flex" />
    </div>
  );
}

export function Hero() {
  const { data, state } = usePreview();
  const g = data ? greeting(data.now) : null;
  return (
    <section aria-label="Today" className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col justify-between gap-6 py-1">
        <div>
          {data ? (
            <p className="text-sm text-ink-3">
              {formatLongDate(data.now)} <span aria-hidden>·</span> Week {isoWeek(data.now)}
            </p>
          ) : (
            <Skeleton className="h-3 w-48" />
          )}
          <h1 className="mt-3 font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] text-ink md:text-[52px]">
            {g ?? "Overview"}
            <span className="text-saffron">.</span>
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-6 text-ink-2">
            {data && state === "ready" ? statusLine(data) : "Your day, your trends and your long game in one place."}
          </p>
        </div>
        <PreviewBar />
      </div>
      <LevelPanel />
    </section>
  );
}
