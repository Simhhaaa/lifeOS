"use client";

import { useState } from "react";
import {
  Bar as RBar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ToggleGroup } from "radix-ui";
import { CalendarDays, Camera, ChevronDown, Dumbbell, LibraryBig, Ruler, Trophy } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Sparkline } from "@/components/ui/sparkline";
import { AXIS, ChartTip, GRID, Legend } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/states";
import { Module } from "@/components/dashboard/module";
import { PageHeader } from "@/components/page/page-header";
import { Change, StatStrip } from "@/components/page/stat-strip";
import { WEEKDAY_SHORT, formatRelativeDay, formatShortDate, startOfDay } from "@/lib/dates";
import { epley1RM } from "@/lib/progression";
import type { Lift } from "@/lib/sample-data";
import { MUSCLES, type Muscle, type WorkoutSession } from "@/lib/sample/fitness";
import { mean } from "@/lib/stats";

const MUSCLE_COLOR: Record<Muscle, string> = {
  Chest: "var(--sky)",
  Back: "var(--lilac)",
  Legs: "var(--mint)",
  Shoulders: "var(--saffron)",
  Arms: "var(--ref)",
};
const kg = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}`;

/* ───────────── This week ───────────── */

function ThisWeek() {
  return (
    <Module
      framed
      title="This week"
      subtitle="Training days and what was logged · Mon–Sun"
      className="xl:col-span-4"
      skeleton={{ rows: 7 }}
      empty={{ icon: CalendarDays, title: "No training plan", description: "Set a split to see planned sessions here." }}
    >
      {(d) => {
        const today = startOfDay(d.now).getTime();
        return (
          <div className="flex flex-col gap-3">
            <p className="text-2xs text-ink-3">Split: Push → Legs → Pull rotation on Mon, Wed, Fri and Sat</p>
            <ol className="flex flex-col">
              {d.fitness.thisWeek.map((day, i) => {
                const t = day.date.getTime();
                const status = day.session
                  ? "done"
                  : !day.planned
                    ? "rest"
                    : t < today
                      ? "missed"
                      : t === today
                        ? "today"
                        : "planned";
                return (
                  <li
                    key={t}
                    className={cn(
                      "flex items-center gap-3 border-t border-edge/70 py-2.5 first:border-t-0",
                      t === today && "-mx-2 rounded-box bg-well px-2",
                    )}
                  >
                    <span className="w-9 text-xs text-ink-3">{WEEKDAY_SHORT[i]}</span>
                    <span
                      aria-hidden
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        status === "done"
                          ? "bg-mint"
                          : status === "missed"
                            ? "ring-[1.5px] ring-coral ring-inset"
                            : status === "rest"
                              ? "bg-well-strong"
                              : "ring-[1.5px] ring-saffron ring-inset",
                      )}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      {day.session ? (
                        <>
                          <span className="text-ink">{day.session.split}</span>
                          <span className="num ml-2 text-2xs text-ink-3">
                            {day.session.top.exercise} {kg(day.session.top.load)} × {day.session.top.reps}
                          </span>
                        </>
                      ) : (
                        <span className={status === "rest" ? "text-ink-3" : "text-ink-2"}>
                          {status === "rest"
                            ? "Rest"
                            : status === "missed"
                              ? "Planned · not logged"
                              : status === "today"
                                ? "Planned today"
                                : "Planned"}
                        </span>
                      )}
                    </span>
                    {day.session?.pr && <Chip tone="saffron">PR</Chip>}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Sessions ───────────── */

function SessionCard({ s, now, open }: { s: WorkoutSession; now: Date; open: boolean }) {
  return (
    <details open={open} className="group rounded-box border border-edge bg-well/40 open:bg-well/60">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="w-20 text-xs text-ink-3">{formatRelativeDay(s.date, now)}</span>
        <span className="font-display text-[15px] font-semibold text-ink">{s.split}</span>
        {s.pr && <Chip tone="saffron">New est. 1RM PR</Chip>}
        <span className="num ml-auto flex items-center gap-4 text-2xs text-ink-3">
          <span>{s.minutes} min</span>
          <span>{s.setCount} sets</span>
          <span>{(s.volume / 1000).toFixed(2)} t</span>
        </span>
        <ChevronDown size={15} className="text-ink-3 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-x-6 gap-y-3 border-t border-edge px-4 py-3 md:grid-cols-2">
        {s.exercises.map((e) => (
          <table key={e.exercise} className="w-full text-xs">
            <caption className="mb-1 text-left text-xs font-medium text-ink">
              {e.exercise} <span className="font-normal text-ink-3">· {e.muscle}</span>
            </caption>
            <thead>
              <tr className="text-[10px] text-ink-3">
                <th scope="col" className="w-8 text-left font-normal">
                  Set
                </th>
                <th scope="col" className="text-right font-normal">
                  kg
                </th>
                <th scope="col" className="text-right font-normal">
                  Reps
                </th>
                <th scope="col" className="text-right font-normal">
                  RPE
                </th>
                <th scope="col" className="text-right font-normal">
                  Est. 1RM
                </th>
              </tr>
            </thead>
            <tbody className="num">
              {e.sets.map((x, i) => {
                const e1 = epley1RM(x.load, x.reps);
                return (
                  <tr key={i} className={x.top ? "text-ink" : "text-ink-2"}>
                    <td className="py-0.5 text-ink-3">{x.top ? "Top" : i + 1}</td>
                    <td className="py-0.5 text-right">{kg(x.load)}</td>
                    <td className="py-0.5 text-right">{x.reps}</td>
                    <td className="py-0.5 text-right text-ink-3">{x.rpe ?? "—"}</td>
                    <td className="py-0.5 text-right text-ink-3">{e1 ? e1.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </details>
  );
}

function Sessions() {
  return (
    <Module
      framed
      title="Recent sessions"
      subtitle="Sets, reps, load and optional RPE · volume = Σ load × reps"
      className="xl:col-span-8"
      skeleton={{ rows: 5 }}
      empty={{
        icon: Dumbbell,
        title: "No workouts logged",
        description: "Log a session with sets, reps and load to start your history.",
        action: "Log workout",
      }}
    >
      {(d) => (
        <div className="flex flex-col gap-2">
          {d.fitness.sessions.slice(0, 5).map((s, i) => (
            <SessionCard key={s.id} s={s} now={d.now} open={i === 0} />
          ))}
          <p className="num mt-1 text-2xs text-ink-3">
            5 of {d.fitness.sessions.length} sessions in the last 8 weeks · RPE is optional and left blank when not logged
          </p>
        </div>
      )}
    </Module>
  );
}

/* ───────────── Progressive overload ───────────── */

const LIFTS: { key: Lift; label: string }[] = [
  { key: "bench", label: "Bench press" },
  { key: "squat", label: "Back squat" },
  { key: "deadlift", label: "Deadlift" },
];

function Overload() {
  const [lift, setLift] = useState<Lift>("bench");
  return (
    <Module
      framed
      title="Progressive overload"
      subtitle="Every logged top set · estimated 1RM and load, kg · last 8 weeks"
      className="xl:col-span-8"
      skeleton={{ rows: 1, block: true }}
      actions={() => (
        <MethodInfo label="estimated 1RM">
          Estimated 1RM uses Epley: load × (1 + reps ÷ 30), valid for 1–10 reps. A PR is a top set whose estimate beats every
          earlier one for that lift. Strength XP and the Strength attribute only move on measured improvement like this, never on
          attendance.
        </MethodInfo>
      )}
      empty={{ icon: Dumbbell, title: "No tracked lifts yet", description: "Log top sets to see estimated 1RM over time." }}
    >
      {(d) => {
        const rows = d.fitness.lifts[lift].map((x) => ({
          label: formatShortDate(x.date),
          e1rm: x.e1rm,
          load: x.load,
          reps: x.reps,
          pr: x.pr ? x.e1rm : null,
        }));
        const first = rows[0]?.e1rm;
        const last = rows[rows.length - 1]?.e1rm;
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup.Root
                type="single"
                value={lift}
                onValueChange={(v) => v && setLift(v as Lift)}
                aria-label="Lift"
                className="flex rounded-full bg-well p-0.5"
              >
                {LIFTS.map((l) => (
                  <ToggleGroup.Item
                    key={l.key}
                    value={l.key}
                    className="h-7 rounded-full px-3 text-xs text-ink-2 transition hover:text-ink data-[state=on]:bg-ink data-[state=on]:text-base"
                  >
                    {l.label}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
              {first !== undefined && last !== undefined && (
                <span className="num text-xs text-ink-2">
                  {first} → <span className="text-ink">{last} kg</span>{" "}
                  <span className={last >= first ? "text-mint" : "text-coral"}>
                    ({last >= first ? "+" : ""}
                    {(last - first).toFixed(1)})
                  </span>
                </span>
              )}
              <span className="ml-auto">
                <Legend
                  items={[
                    { label: "Est. 1RM", color: "var(--sky)" },
                    { label: "Top-set load", color: "var(--ref)", dashed: true },
                    { label: "PR", color: "var(--saffron)" },
                  ]}
                />
              </span>
            </div>
            <div
              className="h-64"
              role="img"
              aria-label={`Estimated 1RM and top-set load for ${LIFTS.find((l) => l.key === lift)?.label} over 8 weeks, with PRs marked`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis
                    {...AXIS}
                    width={40}
                    domain={["dataMin - 6", "dataMax + 4"]}
                    tickFormatter={(v: number) => String(Math.round(v))}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--edge-strong)" }}
                    content={(p) => (
                      <ChartTip
                        active={p.active}
                        label={p.label as string}
                        rows={(p.payload ?? []).filter((x) => x.dataKey !== "pr")}
                        format={(v) => `${v.toFixed(1)} kg`}
                      />
                    )}
                  />
                  <Line
                    dataKey="load"
                    name="Top-set load"
                    stroke="var(--ref)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="e1rm"
                    name="Est. 1RM"
                    stroke="var(--sky)"
                    strokeWidth={2}
                    dot={{ r: 2.5, strokeWidth: 0, fill: "var(--sky)" }}
                    isAnimationActive={false}
                  />
                  <Scatter dataKey="pr" name="PR" fill="var(--saffron)" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

function Records() {
  return (
    <Module
      framed
      title="Personal records"
      subtitle="Best estimated 1RM per tracked lift · last 8 weeks"
      className="xl:col-span-4"
      skeleton={{ rows: 3 }}
      empty={{
        icon: Trophy,
        title: "No records yet",
        description: "PRs appear when a top set beats your previous best estimate.",
      }}
    >
      {(d) => (
        <ul className="flex flex-col gap-2">
          {d.fitness.prs.map((p) => (
            <li key={p.exercise} className="flex items-center gap-3 rounded-box bg-well p-3.5">
              <Trophy size={16} strokeWidth={1.75} className="shrink-0 text-saffron" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-2">{p.exercise}</p>
                <p className="num text-2xs text-ink-3">
                  {kg(p.load)} kg × {p.reps} · {formatRelativeDay(p.date, d.now)}
                </p>
              </div>
              <p className="flex items-baseline gap-1">
                <span className="font-display text-[24px] leading-7 font-semibold tracking-[-0.03em] text-ink">{p.e1rm}</span>
                <span className="text-xs text-ink-3">kg</span>
              </p>
            </li>
          ))}
          <p className="text-2xs text-ink-3">Estimates use Epley on sets of 1–10 reps.</p>
        </ul>
      )}
    </Module>
  );
}

/* ───────────── Volume & frequency ───────────── */

function Volume() {
  return (
    <Module
      framed
      title="Training volume & frequency"
      subtitle="Working sets per muscle group per week · sessions per week · last 8 weeks"
      className="xl:col-span-8"
      skeleton={{ rows: 1, block: true }}
      empty={{
        icon: Dumbbell,
        title: "No volume yet",
        description: "Weekly sets per muscle group appear after your first logged sessions.",
      }}
    >
      {(d) => {
        const rows = d.fitness.weekly.map((w) => ({
          label: formatShortDate(w.weekStart),
          sessions: w.sessions,
          tonnes: Math.round(w.volume / 100) / 10,
          ...w.sets,
        }));
        const avg = mean(d.fitness.weekly.slice(0, -1).map((w) => w.sessions)) ?? 0;
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="text-xs text-ink-2">
                <span className="num text-ink">{avg.toFixed(1)}</span> sessions/week on average (4 planned)
              </p>
              <span className="ml-auto">
                <Legend items={MUSCLES.map((m) => ({ label: m, color: MUSCLE_COLOR[m] }))} />
              </span>
            </div>
            <div className="h-60" role="img" aria-label="Stacked bars of weekly working sets by muscle group over 8 weeks">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barCategoryGap="28%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} width={40} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "var(--well)", opacity: 0.6 }}
                    content={(p) => (
                      <ChartTip
                        active={p.active}
                        label={`Week of ${p.label} · ${(p.payload?.[0]?.payload as { sessions: number })?.sessions ?? 0} sessions · ${(p.payload?.[0]?.payload as { tonnes: number })?.tonnes ?? 0} t`}
                        rows={p.payload}
                        format={(v) => `${v} sets`}
                      />
                    )}
                  />
                  {MUSCLES.map((m, i) => (
                    <RBar
                      key={m}
                      dataKey={m}
                      name={m}
                      stackId="s"
                      fill={MUSCLE_COLOR[m]}
                      radius={i === MUSCLES.length - 1 ? [5, 5, 0, 0] : undefined}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-8 gap-1.5 text-center" aria-label="Sessions per week">
              {rows.map((r) => (
                <div key={r.label} className="rounded-ctl bg-well py-1.5">
                  <p className="num text-sm text-ink">{r.sessions}</p>
                  <p className="text-[10px] text-ink-3">sessions</p>
                </div>
              ))}
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Body ───────────── */

function Body() {
  return (
    <Module
      framed
      title="Body"
      subtitle="Measurements, kg and cm · progress photos stay private"
      className="xl:col-span-4"
      skeleton={{ rows: 4 }}
      empty={{ icon: Ruler, title: "No measurements", description: "Log bodyweight or waist to track body changes." }}
    >
      {(d) => {
        const w = d.fitness.weighIns;
        const wl = w[w.length - 1];
        const waist = d.fitness.waist;
        return (
          <div className="flex flex-col gap-4">
            <div className="rounded-box bg-well p-3.5">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-ink-2">Bodyweight</p>
                <p className="num text-2xs text-ink-3">weekly weigh-in</p>
              </div>
              <p className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-[24px] leading-7 font-semibold tracking-[-0.03em] text-ink">{wl.kg}</span>
                <span className="text-xs text-ink-3">kg</span>
                <span className="num ml-2 text-2xs text-ink-3">
                  <Change now={wl.kg} prev={w[0].kg} suffix={`kg since ${formatShortDate(w[0].date)}`} mode="abs" decimals={1} />
                </span>
              </p>
              <div className="mt-2">
                <Sparkline values={w.map((x) => x.kg)} color="var(--sky)" height={44} label="Bodyweight over 8 weeks" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-box bg-well p-3.5">
              <div>
                <p className="text-xs text-ink-2">Waist</p>
                <p className="num text-2xs text-ink-3">every 2 weeks · {formatShortDate(waist[waist.length - 1].date)}</p>
              </div>
              <p className="flex items-baseline gap-1">
                <span className="font-display text-[22px] font-semibold text-ink">{waist[waist.length - 1].cm}</span>
                <span className="text-xs text-ink-3">cm</span>
              </p>
            </div>
            <EmptyState
              icon={Camera}
              title="No progress photos"
              description="Photos are stored privately and never shared. Uploading is designed in a later phase."
            />
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Exercise library ───────────── */

function Library() {
  return (
    <Module
      framed
      title="Exercise library"
      subtitle="Exercises in your split · sessions and best estimated 1RM, last 8 weeks"
      className="xl:col-span-12"
      skeleton={{ rows: 6 }}
      empty={{
        icon: LibraryBig,
        title: "Library is empty",
        description: "Exercises appear here once added to a split or logged.",
      }}
    >
      {(d) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Exercise library</caption>
            <thead>
              <tr className="text-2xs text-ink-3">
                <th scope="col" className="pb-2 font-normal">
                  Exercise
                </th>
                <th scope="col" className="pb-2 font-normal">
                  Muscle group
                </th>
                <th scope="col" className="pb-2 font-normal">
                  Equipment
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  Sessions
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  Best est. 1RM
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  Last done
                </th>
              </tr>
            </thead>
            <tbody>
              {d.fitness.library.map((x) => (
                <tr key={x.exercise} className="border-t border-edge/70">
                  <td className="py-2 text-ink">{x.exercise}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-1.5 text-xs text-ink-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: MUSCLE_COLOR[x.muscle] }} aria-hidden />
                      {x.muscle}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-ink-3">{x.equipment}</td>
                  <td className="num py-2 text-right text-ink-2">{x.sessions}</td>
                  <td className="num py-2 text-right text-ink">
                    {x.best !== null ? (
                      `${x.best} kg`
                    ) : (
                      <span className="text-2xs text-ink-3" title="Epley is only valid for 1–10 reps">
                        — (12+ reps)
                      </span>
                    )}
                  </td>
                  <td className="num py-2 text-right text-2xs text-ink-3">{x.last ? formatRelativeDay(x.last, d.now) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Module>
  );
}

export function FitnessPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fitness"
        description="Sessions, sets and progressive overload. Strength only counts measured improvement in load, reps or estimated 1RM, never attendance alone."
        action="Log workout"
      />
      <StatStrip
        labels={["Sessions this week", "Volume, last week", "Est. 1RM PRs", "Bodyweight"]}
        stats={(d) => {
          const wk = d.fitness.weekly;
          const last = wk[wk.length - 2];
          const avg4 = mean(wk.slice(-6, -2).map((w) => w.volume)) ?? 0;
          const done = d.fitness.thisWeek.filter((x) => x.session).length;
          const planned = d.fitness.thisWeek.filter((x) => x.planned).length;
          const prs = d.fitness.sessions.filter((s) => s.pr).length;
          const w = d.fitness.weighIns;
          return [
            { label: "Sessions this week", value: String(done), unit: `of ${planned} planned`, note: "week starts Monday" },
            {
              label: "Volume, last week",
              value: (last.volume / 1000).toFixed(1),
              unit: "t",
              note: <Change now={last.volume} prev={avg4} suffix="vs prior 4-week avg" />,
            },
            { label: "Est. 1RM PRs", value: String(prs), unit: "in 8 weeks", accent: true, note: "tracked lifts only" },
            {
              label: "Bodyweight",
              value: String(w[w.length - 1].kg),
              unit: "kg",
              note: <Change now={w[w.length - 1].kg} prev={w[0].kg} suffix="kg in 8 weeks" mode="abs" decimals={1} />,
            },
          ];
        }}
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <ThisWeek />
        <Sessions />
        <Overload />
        <Records />
        <Volume />
        <Body />
        <Library />
      </div>
    </div>
  );
}
