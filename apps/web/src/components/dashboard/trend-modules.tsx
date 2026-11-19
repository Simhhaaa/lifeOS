"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookOpen, Dumbbell, Lightbulb, Trophy, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip, type Tone } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Sparkline } from "@/components/ui/sparkline";
import { WEEKDAY_SHORT, formatRelativeDay, formatShortDate, weekdayIndex } from "@/lib/dates";
import type { Insight, StrengthWeek } from "@/lib/types";
import { Module } from "./module";

const AXIS = {
  stroke: "var(--edge-strong)",
  tick: { fill: "var(--ink-3)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-2xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="w-3.5 border-t-[1.5px] border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* ───────────── Study & coding ───────────── */

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0) return <span className="text-ink-3">no prior data</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  return (
    <span className={pct > 0 ? "text-mint" : pct < 0 ? "text-coral" : "text-ink-3"}>
      {pct > 0 ? "+" : ""}
      {pct}%<span className="text-ink-3"> vs prior 14 days</span>
    </span>
  );
}

function Total({ label, color, value, prev }: { label: string; color: string; value: number; prev: number }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-ink-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 font-display text-[28px] leading-8 font-semibold tracking-[-0.03em] text-ink">
        {value.toFixed(1)}
        <span className="ml-1 text-sm font-normal text-ink-3">h</span>
      </p>
      <p className="num text-2xs">
        <Delta now={value} prev={prev} />
      </p>
    </div>
  );
}

export function StudyCoding({ className }: { className?: string }) {
  return (
    <Module
      title="Study & coding"
      subtitle="Last 14 days · focused hours per day"
      href="/academics"
      className={className}
      skeleton={{ rows: 1, block: true }}
      actions={() => (
        <MethodInfo label="these totals">
          Totals add up focused minutes from logged study and coding sessions over the last 14 days, in hours. The
          change compares them with the 14 days before. The dashed line is the 7-day rolling average of both
          combined. Hours show effort, not skill: skill progress lives in Skills and Attributes.
        </MethodInfo>
      )}
      empty={{
        icon: BookOpen,
        title: "No study or coding sessions",
        description: "Focused sessions you log appear here as daily hours with a 7-day average.",
        action: "Log study session",
      }}
    >
      {(d) => {
        const a = d.activity;
        const rows = a.days.map((x) => ({
          key: x.date.getTime(),
          label: `${WEEKDAY_SHORT[weekdayIndex(x.date)].slice(0, 2)} ${x.date.getDate()}`,
          study: Math.round(x.study * 10) / 10,
          coding: Math.round(x.coding * 10) / 10,
          avg7: x.avg7,
        }));
        return (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <Total label="Study" color="var(--sky)" value={a.studyTotal} prev={a.prevStudyTotal} />
              <Total label="Coding" color="var(--lilac)" value={a.codingTotal} prev={a.prevCodingTotal} />
              <div className="ml-auto">
                <Legend items={[{ label: "7-day avg, combined", color: "var(--ref)", dashed: true }]} />
              </div>
            </div>
            <div
              className="h-64"
              role="img"
              aria-label="Stacked bar chart of daily study and coding hours for the last 14 days, with a 7-day average line"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 6, right: 2, bottom: 0, left: -18 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={10} />
                  <YAxis {...AXIS} unit="h" width={42} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "var(--well)", opacity: 0.6 }}
                    content={(p) =>
                      p.active && p.payload?.length ? (
                        <div className="rounded-ctl border border-edge-strong bg-slab px-3 py-2 text-xs shadow-xl shadow-black/50">
                          <p className="mb-1 text-2xs text-ink-3">{String(p.label)}</p>
                          {p.payload.map((x) => (
                            <p key={String(x.dataKey)} className="flex justify-between gap-5">
                              <span className="text-ink-2">{x.name}</span>
                              <span className="num text-ink">{Number(x.value).toFixed(1)} h</span>
                            </p>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="study" name="Study" stackId="a" fill="var(--sky)" maxBarSize={20} isAnimationActive={false} />
                  <Bar
                    dataKey="coding"
                    name="Coding"
                    stackId="a"
                    fill="var(--lilac)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="avg7"
                    name="7-day avg"
                    stroke="var(--ref)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Strength (small multiples) ───────────── */

const LIFTS: { key: keyof Omit<StrengthWeek, "weekStart">; label: string }[] = [
  { key: "bench", label: "Bench press" },
  { key: "squat", label: "Back squat" },
  { key: "deadlift", label: "Deadlift" },
];

function LiftCard({ label, values, weeks }: { label: string; values: (number | null)[]; weeks: Date[] }) {
  const recorded = values.filter((v): v is number => v !== null);
  const first = recorded[0];
  const last = recorded[recorded.length - 1];
  const change = recorded.length >= 2 ? last - first : null;
  return (
    <div className="flex min-w-0 flex-col rounded-box bg-well p-3.5">
      <p className="truncate text-xs text-ink-2">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className="font-display text-[24px] leading-7 font-semibold tracking-[-0.03em] text-ink">
          {last !== undefined ? last.toFixed(1) : "—"}
        </span>
        <span className="text-xs text-ink-3">kg</span>
      </p>
      <p className="num text-2xs">
        {change === null ? (
          <span className="text-ink-3">not enough weeks</span>
        ) : (
          <span
            className={cn("whitespace-nowrap", change > 0 ? "text-mint" : change < 0 ? "text-coral" : "text-ink-3")}
            title="Change from the first to the last recorded week shown"
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(1)} kg
          </span>
        )}
      </p>
      <div className="mt-3">
        <Sparkline
          values={values}
          height={52}
          label={`${label}: weekly best estimated 1RM from ${first ?? "—"} to ${last ?? "—"} kg over 8 weeks`}
        />
      </div>
      <div className="num mt-1.5 flex justify-between text-[10px] text-ink-3">
        <span>{formatShortDate(weeks[0])}</span>
        <span>{formatShortDate(weeks[weeks.length - 1])}</span>
      </div>
    </div>
  );
}

export function StrengthMultiples({ className }: { className?: string }) {
  return (
    <Module
      title="Strength"
      subtitle="Last 8 weeks · weekly best est. 1RM, kg · change since first week"
      href="/fitness"
      className={className}
      skeleton={{ rows: 1, block: true }}
      actions={() => (
        <MethodInfo label="estimated 1RM">
          Estimated one-rep max uses the Epley formula, load × (1 + reps ÷ 30), on logged top sets of 1–10 reps. Each
          point is the best estimate for that lift in a week (weeks start Monday); each lift has its own scale. The
          change is last recorded week minus first. Gym attendance alone does not move these.
        </MethodInfo>
      )}
      empty={{
        icon: Dumbbell,
        title: "No tracked lifts yet",
        description: "Log sets with load and reps to see estimated 1RM progress per lift.",
        action: "Log workout",
      }}
    >
      {(d) => {
        const pr = d.strength.latestPr;
        const weeks = d.strength.weeks.map((w) => w.weekStart);
        return (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 @sm:grid-cols-3">
              {LIFTS.map((l) => (
                <LiftCard key={l.key} label={l.label} values={d.strength.weeks.map((w) => w[l.key])} weeks={weeks} />
              ))}
            </div>
            {pr ? (
              <p className="flex items-center gap-2 text-xs text-ink-2">
                <Trophy size={14} strokeWidth={1.75} className="shrink-0 text-saffron" aria-hidden />
                <span>
                  Latest PR: <span className="text-ink">{pr.lift}</span>{" "}
                  <span className="num whitespace-nowrap text-ink">{pr.e1rm} kg</span>{" "}
                  <span className="num whitespace-nowrap text-ink-3">
                    est. from {pr.load} kg × {pr.reps} · {formatRelativeDay(pr.date, d.now)}
                  </span>
                </span>
              </p>
            ) : (
              <p className="text-xs text-ink-3">No new PR in the last 8 weeks.</p>
            )}
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Insights ───────────── */

const KIND: Record<Insight["kind"], { label: string; tone: Tone }> = {
  correlation: { label: "Correlation", tone: "sky" },
  trend: { label: "Trend", tone: "mint" },
  plateau: { label: "Plateau", tone: "coral" },
};

function InsightList({ items }: { items: Insight[] }) {
  // Dismissals are local-only in Phase 0.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = items.filter((i) => !dismissed.includes(i.id));
  if (!visible.length) {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-3">
        <Lightbulb size={14} strokeWidth={1.75} aria-hidden />
        No insights right now. They appear only when the data supports them.
      </p>
    );
  }
  return (
    <ul className={cn("grid gap-2", visible.length > 1 && "@2xl:grid-cols-2", visible.length > 2 && "@4xl:grid-cols-3")}>
      {visible.map((i) => (
        <li key={i.id} className="flex flex-col rounded-box border border-edge bg-well/50 p-3.5">
          <div className="flex items-center gap-2">
            <Chip tone={KIND[i.kind].tone}>{KIND[i.kind].label}</Chip>
            <span className="num truncate text-2xs text-ink-3">{i.window}</span>
            <button
              type="button"
              onClick={() => setDismissed((d) => [...d, i.id])}
              aria-label={`Dismiss insight: ${i.title}`}
              className="-m-1 ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-well-strong hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-2 font-display text-[16px] leading-5 font-semibold text-ink">{i.title}</p>
          <p className="mt-1 text-xs text-ink-2">{i.detail}</p>
          <details className="mt-2 text-2xs text-ink-3">
            <summary className="w-fit cursor-pointer list-none underline decoration-dotted underline-offset-2 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
              How was this found?
            </summary>
            <p className="mt-1 leading-4">{i.method}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function Insights({ className }: { className?: string }) {
  return (
    <Module
      title="Insights"
      subtitle="Rule-based and explainable · at most three"
      href="/analytics"
      className={className}
      skeleton={{ rows: 2 }}
      empty={{
        icon: Lightbulb,
        title: "Not enough history yet",
        description: "Insights need 2–4 weeks of logs. Each one names its data and time window.",
      }}
    >
      {(d) => <InsightList items={d.insights} />}
    </Module>
  );
}
