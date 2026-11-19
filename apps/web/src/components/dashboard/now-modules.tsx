"use client";

import { useState } from "react";
import { Checkbox } from "radix-ui";
import { CalendarCheck, Check, History, ListTodo, Moon } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Bar, Pips } from "@/components/ui/progress";
import { DAY_MS, WEEKDAY_SHORT, formatShortDate, formatTime, startOfDay, weekdayIndex } from "@/lib/dates";
import { SLEEP_TARGET_H, scalePoints, sleepPoints } from "@/lib/progression";
import type { DayStatus, FocusTask, XpEvent } from "@/lib/types";
import { Module } from "./module";

const fmtH = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

/* ───────────── Readiness ───────────── */

function InputTile({ label, value, points }: { label: string; value: string; points: number | null }) {
  return (
    <div className="rounded-box bg-well px-3 py-2.5">
      <p className="text-2xs text-ink-3">{label}</p>
      <p className="num mt-0.5 text-[15px] text-ink">{value}</p>
      {points !== null && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Pips current={points} target={2} size="sm" tone="saffron" label={`${label}: ${points} of 2 points`} />
          <span className="num text-2xs text-ink-3">{points}/2</span>
        </div>
      )}
    </div>
  );
}

export function Readiness() {
  return (
    <Module
      title="Readiness"
      subtitle="Today’s check-in · self-reported"
      href="/health"
      skeleton={{ rows: 3 }}
      actions={() => (
        <MethodInfo label="readiness">
          Each input adds points: sleep ≥ {SLEEP_TARGET_H} h = 2, ≥ {SLEEP_TARGET_H - 1} h = 1; energy and recovery
          (1–5): 4 or more = 2, 3 = 1. Total 5–6 is High, 3–4 Moderate, 0–2 Low. Shown only when all three are
          logged. A planning aid, not medical advice.
        </MethodInfo>
      )}
      empty={{
        icon: Moon,
        title: "No check-in today",
        description: "Log sleep, energy and recovery to see today’s readiness.",
        action: "Daily check-in",
      }}
    >
      {(d) => {
        const r = d.readiness;
        const level = r.result?.level;
        const max = 10;
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "font-display text-[30px] leading-8 font-semibold tracking-[-0.03em]",
                  level === "High" ? "text-mint" : level === "Low" ? "text-coral" : "text-ink",
                )}
              >
                {level ?? "Incomplete"}
              </span>
              {r.result && <span className="num text-xs text-ink-3">{r.result.points} of 6 points</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <InputTile
                label="Sleep"
                value={r.sleepLastNight === null ? "—" : fmtH(r.sleepLastNight)}
                points={r.sleepLastNight === null ? null : sleepPoints(r.sleepLastNight)}
              />
              <InputTile label="Energy" value={`${r.energy ?? "—"}/5`} points={r.energy === null ? null : scalePoints(r.energy)} />
              <InputTile
                label="Recovery"
                value={`${r.recovery ?? "—"}/5`}
                points={r.recovery === null ? null : scalePoints(r.recovery)}
              />
            </div>
            <figure aria-label={`Sleep over the last 7 nights, average ${fmtH(r.sleepAvg7)}`}>
              <div className="relative flex h-11 items-end gap-1.5">
                <div
                  aria-hidden
                  className="absolute inset-x-0 border-t border-dashed border-ref"
                  style={{ bottom: `${(SLEEP_TARGET_H / max) * 100}%` }}
                />
                {r.sleepSeries.map((s) => (
                  <div
                    key={s.date.getTime()}
                    title={s.hours === null ? "No log" : fmtH(s.hours)}
                    className={cn(
                      "flex-1 rounded-t-[4px]",
                      s.hours === null ? "h-0.5 bg-edge-strong" : s.hours >= SLEEP_TARGET_H ? "bg-sky" : "bg-sky/35",
                    )}
                    style={s.hours === null ? undefined : { height: `${(s.hours / max) * 100}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex gap-1.5 text-2xs text-ink-3">
                {r.sleepSeries.map((s) => (
                  <span key={s.date.getTime()} className="flex-1 text-center">
                    {WEEKDAY_SHORT[weekdayIndex(s.date)][0]}
                  </span>
                ))}
              </div>
              <figcaption className="mt-1 text-2xs text-ink-3">
                Sleep, last 7 nights · avg <span className="num">{fmtH(r.sleepAvg7)}</span> · dashed line ={" "}
                {SLEEP_TARGET_H} h target
              </figcaption>
            </figure>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Today's focus ───────────── */

function TaskList({ initial }: { initial: FocusTask[] }) {
  // Local-only toggles for the design preview; nothing is persisted.
  const [tasks, setTasks] = useState(initial);
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-3">
        <Bar value={done / tasks.length} tone="mint" size="sm" label="Planned items completed today" />
        <span className="num shrink-0 text-2xs text-ink-3">
          {done}/{tasks.length} done
        </span>
      </div>
      <ul className="-mx-2 flex flex-col">
        {tasks.map((t) => (
          <li key={t.id}>
            <label className="group flex min-h-12 cursor-pointer items-center gap-3 rounded-box px-2 py-2 transition hover:bg-well/60">
              <Checkbox.Root
                checked={t.done}
                onCheckedChange={(c) => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: c === true } : x)))}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] border-edge-strong transition group-hover:border-ink-3 data-[state=checked]:border-mint data-[state=checked]:bg-mint"
              >
                <Checkbox.Indicator>
                  <Check size={12} strokeWidth={3} className="text-base" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", t.done ? "text-ink-3 line-through" : "text-ink")}>
                  {t.title}
                </span>
                <span className="block truncate text-2xs text-ink-3">{t.meta}</span>
              </span>
              {t.priority === "high" && !t.done && <Chip tone="saffron">Priority</Chip>}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-2xs text-ink-3">Ticks are not saved in Phase 0.</p>
    </div>
  );
}

export function TodayFocus() {
  return (
    <Module
      title="Today’s focus"
      subtitle="Planned items"
      href="/productivity"
      skeleton={{ rows: 5 }}
      empty={{
        icon: ListTodo,
        title: "Nothing planned for today",
        description: "Plan 3–5 items so consistency is measured against what you intended.",
        action: "Plan today",
      }}
    >
      {(d) => <TaskList initial={d.tasks} />}
    </Module>
  );
}

/* ───────────── Consistency ───────────── */

const DOT: Record<DayStatus, string> = {
  "on-plan": "bg-mint",
  partial: "bg-[conic-gradient(var(--mint)_0_50%,transparent_50%_100%)] ring-1 ring-mint/70 ring-inset",
  missed: "ring-[1.5px] ring-coral ring-inset",
  rest: "ring-1 ring-edge-strong ring-inset [background:radial-gradient(var(--edge-strong)_1.5px,transparent_2px)]",
  today: "ring-[1.5px] ring-saffron ring-inset",
  future: "bg-well/60",
};
const LABEL: Record<DayStatus, string> = {
  "on-plan": "On plan",
  partial: "Partial",
  missed: "Missed",
  rest: "Rest (nothing planned)",
  today: "Today (in progress)",
  future: "Upcoming",
};

export function Consistency() {
  return (
    <Module
      title="Consistency"
      subtitle="Days on plan · last 4 weeks, Mon–Sun"
      href="/productivity"
      skeleton={{ rows: 2, block: true }}
      actions={() => (
        <MethodInfo label="consistency">
          A day is <em>on plan</em> when at least 80% of its planned items are done, <em>partial</em> at 40–79% and{" "}
          <em>missed</em> below 40%. Days with nothing planned are rest days and are left out. Today is scored when
          it ends.
        </MethodInfo>
      )}
      empty={{
        icon: CalendarCheck,
        title: "No planned days yet",
        description: "Consistency is measured against what you plan. Plan a day to start.",
      }}
    >
      {(d) => {
        const c = d.consistency;
        const delta = c.thisWeekOnPlan - c.prevWeeksAvgOnPlan;
        return (
          <div className="flex flex-col gap-4">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-[30px] leading-8 font-semibold tracking-[-0.03em] text-ink">
                {c.thisWeekOnPlan}
                <span className="text-ink-3">/{c.thisWeekPlannedDays}</span>
              </span>
              <span className="text-xs text-ink-2">planned days on plan this week</span>
              <span className="num text-2xs text-ink-3">
                prior 3-wk avg {c.prevWeeksAvgOnPlan.toFixed(1)}{" "}
                <span className={delta < 0 ? "text-coral" : delta > 0 ? "text-mint" : ""}>
                  ({delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)})
                </span>
              </span>
            </p>
            <div role="grid" aria-label="Plan adherence by day, last 4 weeks" className="flex flex-col gap-2">
              <div role="row" className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1.5">
                <span role="columnheader" className="sr-only">
                  Week of
                </span>
                {WEEKDAY_SHORT.map((w) => (
                  <span key={w} role="columnheader" className="text-center text-2xs text-ink-3">
                    {w.slice(0, 2)}
                  </span>
                ))}
              </div>
              {c.weeks.map((row, i) => (
                <div role="row" key={i} className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] items-center gap-1.5">
                  <span role="rowheader" className="num text-2xs text-ink-3">
                    {i === c.weeks.length - 1 ? "This wk" : formatShortDate(row[0].date)}
                  </span>
                  {row.map((cell) => (
                    <span
                      role="gridcell"
                      key={cell.date.getTime()}
                      aria-label={`${formatShortDate(cell.date)}: ${LABEL[cell.status]}${cell.planned ? `, ${cell.completed} of ${cell.planned}` : ""}`}
                      title={`${formatShortDate(cell.date)} · ${LABEL[cell.status]}${cell.planned ? ` · ${cell.completed}/${cell.planned}` : ""}`}
                      className={cn("mx-auto aspect-square w-full max-w-6 rounded-full", DOT[cell.status])}
                    />
                  ))}
                </div>
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-2xs text-ink-3">
              {(["on-plan", "partial", "missed", "rest", "today"] as DayStatus[]).map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", DOT[s])} />
                  {LABEL[s].split(" (")[0]}
                </li>
              ))}
            </ul>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── XP stream ───────────── */

function dayLabel(d: Date, now: Date): string {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d);
  return formatShortDate(d);
}

function groupByDay(events: XpEvent[], now: Date) {
  const groups: { key: number; label: string; total: number; items: XpEvent[] }[] = [];
  for (const e of events) {
    const key = startOfDay(e.at).getTime();
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: dayLabel(e.at, now), total: 0, items: [] };
      groups.push(g);
    }
    g.items.push(e);
    g.total += e.amount;
  }
  return groups;
}

export function XpStream() {
  return (
    <Module
      title="Recent XP"
      subtitle="Server-awarded · every entry shows its reason"
      href="/skills"
      skeleton={{ rows: 5 }}
      empty={{
        icon: History,
        title: "No XP yet",
        description: "Each validated activity adds an entry with its reason and any cap applied.",
      }}
    >
      {(d) => (
        <ol className="flex flex-col gap-4">
          {groupByDay(d.xpEvents, d.now).map((g) => (
            <li key={g.key}>
              <p className="mb-2 flex items-baseline justify-between text-xs">
                <span className="font-medium text-ink-2">{g.label}</span>
                <span className="num text-ink-3">
                  <span className="text-saffron">+{g.total}</span> XP
                </span>
              </p>
              <ol className="relative flex flex-col gap-2.5 border-l border-edge-strong pl-4">
                {g.items.map((e) => (
                  <li key={e.id} className="relative">
                    <span aria-hidden className="absolute top-[7px] -left-[19.5px] h-[7px] w-[7px] rounded-full bg-saffron" />
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.reason}</span>
                      <span className="num shrink-0 text-sm text-saffron">+{e.amount}</span>
                    </div>
                    <p className="truncate text-2xs text-ink-3">
                      {e.skill}
                      {g.label === "Today" && <> · {formatTime(e.at)}</>}
                      {e.capNote && <span className="text-coral"> · {e.capNote}</span>}
                    </p>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </Module>
  );
}
