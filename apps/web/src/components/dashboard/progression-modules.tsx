"use client";

import Link from "next/link";
import { Check, Flag, Gauge, Swords, Target } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { FormBadge } from "@/components/ui/form-badge";
import { MethodInfo, Tooltip } from "@/components/ui/info";
import { Bar, Pips } from "@/components/ui/progress";
import { addDays, DAY_MS, startOfDay, startOfWeek } from "@/lib/dates";
import {
  ATTRIBUTE_MIN_COVERAGE,
  FORM_BASELINE_DAYS,
  FORM_RECENT_DAYS,
  type AttributeResult,
} from "@/lib/progression";
import { Module } from "./module";

/* ───────────── Attributes: the formula, drawn ───────────── */

function Lane({ a }: { a: AttributeResult }) {
  return (
    <div className="flex h-2.5 w-full gap-[3px]" aria-hidden>
      {a.signals.map((s) => (
        <span
          key={s.key}
          className={cn("relative h-full overflow-hidden rounded-full", s.score === null ? "hatch text-edge-strong ring-1 ring-edge-strong ring-inset" : "bg-well-strong")}
          style={{ flexGrow: s.weight, flexBasis: 0 }}
        >
          {s.score !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-sky" style={{ width: `${s.score}%` }} />}
        </span>
      ))}
    </div>
  );
}

export function Attributes() {
  return (
    <Module
      title="Attributes"
      subtitle="Current capability · 0–100 against your own targets"
      href="/skills"
      skeleton={{ rows: 5 }}
      actions={() => (
        <MethodInfo label="attributes">
          An attribute is a weighted average of measured signals, each scored 0–100 against your own target. In
          each bar, a segment’s width is that signal’s weight and its fill is the signal’s score. Hatched segments
          have no data; they are left out and the other weights re-normalised. Below{" "}
          {Math.round(ATTRIBUTE_MIN_COVERAGE * 100)}% coverage no score is shown. Attributes can go down; levels
          cannot. Session counts alone never raise Strength or Intelligence.
        </MethodInfo>
      )}
      empty={{
        icon: Gauge,
        title: "No attribute data yet",
        description: "Attributes appear once enough measured signals exist, such as lifts, runs, sleep and study outcomes.",
      }}
    >
      {(d) => (
        <div className="flex flex-col gap-3.5">
          <ul className="flex flex-col gap-3.5">
            {d.attributes.map((a) => (
              <li key={a.key}>
                <Tooltip
                  content={
                    <span className="block text-xs">
                      <strong className="font-semibold">{a.label}</strong> · {Math.round(a.coverage * 100)}% of the formula has data
                      {a.signals.map((s) => (
                        <span key={s.key} className="mt-1 flex justify-between gap-4 text-ink-2">
                          <span>
                            {s.label} <span className="text-ink-3">· weight {Math.round(s.weight * 100)}%</span>
                          </span>
                          <span className="num text-ink">{s.score ?? "no data"}</span>
                        </span>
                      ))}
                    </span>
                  }
                >
                  <div
                    tabIndex={0}
                    aria-label={`${a.label}: ${a.score ?? "not enough data"}, ${Math.round(a.coverage * 100)} percent coverage`}
                    className="rounded-ctl outline-offset-4"
                  >
                    <div className="mb-1.5 flex items-baseline gap-2">
                      <span className="text-sm text-ink">{a.label}</span>
                      {a.coverage < 1 && (
                        <span className="text-2xs text-ink-3">{Math.round(a.coverage * 100)}% coverage</span>
                      )}
                      <span className="ml-auto font-display text-[20px] leading-6 font-semibold tracking-[-0.02em] text-ink">
                        {a.score ?? <span className="text-sm font-normal text-ink-3">not enough data</span>}
                      </span>
                    </div>
                    <Lane a={a} />
                  </div>
                </Tooltip>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-3">
            <span>Segment width = signal weight</span>
            <span>Fill = score vs target</span>
            <span className="flex items-center gap-1">
              <span className="hatch inline-block h-2 w-3 rounded-full text-edge-strong ring-1 ring-edge-strong" aria-hidden /> no data
            </span>
          </p>
        </div>
      )}
    </Module>
  );
}

/* ───────────── Skills ───────────── */

export function Skills() {
  return (
    <Module
      title="Skills"
      subtitle={`Lifetime level · form = last ${FORM_RECENT_DAYS} days vs prior ${FORM_BASELINE_DAYS}`}
      href="/skills"
      skeleton={{ rows: 6 }}
      actions={() => (
        <MethodInfo label="skill level and form">
          <strong className="font-semibold text-ink">Level</strong> comes from lifetime skill XP and never goes down.{" "}
          <strong className="font-semibold text-ink">Form</strong> compares the average of a measured metric over the
          last {FORM_RECENT_DAYS} days with the {FORM_BASELINE_DAYS} days before. It needs at least 4 recent and 8
          baseline records; changes within ±5% show as stable. Hover a form chip to see its metric.
        </MethodInfo>
      )}
      empty={{
        icon: Swords,
        title: "No skill XP yet",
        description: "Skills level up from validated activity and measured outcomes.",
      }}
    >
      {(d) => (
        <div className="flex flex-col gap-3">
          <ul className="grid grid-cols-1 gap-2 @xs:grid-cols-2">
            {d.skills.map((s) => (
              <li key={s.key} className="flex min-w-0 flex-col rounded-box bg-well p-3">
                <span className="truncate text-xs text-ink-2">{s.name}</span>
                <div className="mt-1 mb-2 flex items-center gap-1">
                  <span className="text-2xs text-ink-3">Lv</span>
                  <span className="font-display text-[24px] leading-7 font-semibold tracking-[-0.03em] text-ink">
                    {s.progress.level}
                  </span>
                  <span className="ml-auto">
                    <FormBadge form={s.form} metric={s.formMetric} />
                  </span>
                </div>
                <Bar value={s.progress.ratio} size="sm" label={`${s.name}: progress to level ${s.progress.level + 1}`} />
              </li>
            ))}
          </ul>
          <Link href="/skills" className="text-xs text-ink-2 hover:text-saffron">
            {d.skills.length} of {d.totalSkills} skills shown · View all
          </Link>
        </div>
      )}
    </Module>
  );
}

/* ───────────── Weekly quests ───────────── */

export function WeeklyQuests() {
  return (
    <Module
      title="Weekly quests"
      subtitle="Reset every Monday"
      href="/goals"
      skeleton={{ rows: 4 }}
      empty={{
        icon: Target,
        title: "No quests this week",
        description: "Quests are small weekly targets, such as 4 workouts or 10 focused hours.",
      }}
    >
      {(d) => {
        const resetIn = Math.round((addDays(startOfWeek(d.now), 7).getTime() - startOfDay(d.now).getTime()) / DAY_MS);
        return (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {d.quests.map((q) => {
                const done = q.current >= q.target;
                const countable = Number.isInteger(q.target) && q.target <= 10;
                return (
                  <li key={q.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                          done ? "bg-mint text-base" : "ring-1 ring-edge-strong ring-inset",
                        )}
                        aria-hidden
                      >
                        {done && <Check size={10} strokeWidth={3.5} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {q.title}
                        {done && <span className="sr-only"> (complete)</span>}
                      </span>
                      <span className="num shrink-0 text-xs text-ink-2">
                        {q.current}
                        <span className="text-ink-3">
                          /{q.target} {q.unit}
                        </span>
                      </span>
                    </div>
                    <div className="pl-6">
                      {countable ? (
                        <Pips current={Math.floor(q.current)} target={q.target} tone={done ? "mint" : "saffron"} label={q.title} />
                      ) : (
                        <Bar value={q.current / q.target} tone={done ? "mint" : "saffron"} size="sm" label={q.title} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-2xs text-ink-3">
              Resets in {resetIn} {resetIn === 1 ? "day" : "days"} (Monday)
            </p>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Goals ───────────── */

export function Goals() {
  return (
    <Module
      title="Goals"
      subtitle="Active · measured from start to target"
      href="/goals"
      skeleton={{ rows: 3 }}
      empty={{
        icon: Flag,
        title: "No active goals",
        description: "Set a measurable goal, such as a lift target or finishing a syllabus.",
        action: "New goal",
      }}
    >
      {(d) => (
        <ul className="flex flex-col gap-2">
          {d.goals.map((g) => {
            const ratio = Math.max(0, Math.min(1, (g.current - g.start) / (g.target - g.start)));
            const daysLeft = Math.round((g.due.getTime() - startOfDay(d.now).getTime()) / DAY_MS);
            return (
              <li key={g.id} className="rounded-box bg-well p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm text-ink">{g.title}</span>
                  <Chip>{daysLeft} days left</Chip>
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="num text-2xs text-ink-3">{g.start}</span>
                  <div className="relative flex-1">
                    <Bar value={ratio} label={`${g.title}: ${Math.round(ratio * 100)} percent of the way`} />
                    <span
                      aria-hidden
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-well bg-saffron"
                      style={{ left: `${ratio * 100}%` }}
                    />
                  </div>
                  <span className="num text-2xs text-ink-3">{g.target}</span>
                </div>
                <p className="mt-2 flex flex-wrap justify-between gap-x-3 text-2xs text-ink-3">
                  <span>
                    Now <span className="num text-ink">{g.current}</span> {g.unit}
                  </span>
                  <span>Next: {g.nextMilestone}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Module>
  );
}
