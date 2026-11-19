"use client";

import Link from "next/link";
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Check, Hourglass, MonitorSmartphone, Repeat } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { AXIS, ChartTip, GRID, Legend } from "@/components/ui/chart";
import { Module } from "@/components/dashboard/module";
import { LiveTasks } from "@/components/live/live-tasks";
import { PageHeader } from "@/components/page/page-header";
import { Change, StatStrip } from "@/components/page/stat-strip";
import { WEEKDAY_SHORT, formatTime, startOfDay, weekdayIndex } from "@/lib/dates";
import { mean } from "@/lib/stats";

const dayLabel = (d: Date) => `${WEEKDAY_SHORT[weekdayIndex(d)].slice(0, 2)} ${d.getDate()}`;

/* ───────────── Week agenda ───────────── */

const KIND = {
  deadline: { dot: "bg-saffron", text: "text-ink" },
  workout: { dot: "bg-mint", text: "text-ink-2" },
  exam: { dot: "bg-coral", text: "text-ink" },
  milestone: { dot: "bg-sky", text: "text-ink" },
  task: { dot: "bg-ink-3", text: "text-ink-2" },
} as const;

/** Compact Mon–Sun agenda: one row per day, items inline, the day's plan adherence on the right. */
function Week() {
  return (
    <Module
      framed
      title="This week"
      subtitle="Deadlines, milestones, tasks and training · Mon–Sun"
      skeleton={{ rows: 7 }}
      empty={{ icon: CalendarDays, title: "No calendar items", description: "Deadlines and planned sessions appear here." }}
    >
      {(d) => {
        const today = startOfDay(d.now).getTime();
        return (
          <div className="flex flex-col gap-3">
            <ol className="flex flex-col">
              {d.productivity.week.map((day, i) => {
                const t = day.date.getTime();
                const isToday = t === today;
                const past = t < today;
                const ratio = day.adherence ? day.adherence.completed / day.adherence.planned : null;
                return (
                  <li
                    key={t}
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "flex items-start gap-3 rounded-ctl px-2 py-1.5",
                      isToday ? "bg-well ring-1 ring-saffron-line" : "border-t border-edge/60 first:border-t-0",
                      isToday && "[&+li]:border-t-transparent",
                    )}
                  >
                    <span className={cn("flex w-14 shrink-0 items-baseline gap-1.5 pt-px", past && "opacity-60")}>
                      <span className={cn("text-2xs", isToday ? "text-saffron" : "text-ink-3")}>{WEEKDAY_SHORT[i]}</span>
                      <span className="num text-sm text-ink">{day.date.getDate()}</span>
                    </span>
                    <span className={cn("flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1", past && "opacity-60")}>
                      {day.items.length ? (
                        day.items.map((it, k) => (
                          <span key={k} className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs", KIND[it.kind].text)}>
                            <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", KIND[it.kind].dot)} />
                            <span className={cn("truncate", it.done && "text-ink-3 line-through decoration-ink-3/60")}>{it.title}</span>
                            {it.done && <Check size={11} strokeWidth={3} className="shrink-0 text-mint" aria-label="done" />}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-ink-3">Free</span>
                      )}
                    </span>
                    <span
                      className={cn("num w-14 shrink-0 pt-px text-right text-2xs", ratio === null ? "text-ink-3" : ratio >= 0.8 ? "text-mint" : "text-ink-2")}
                      title={day.adherence ? "Planned items completed that day" : undefined}
                    >
                      {day.adherence ? `${day.adherence.completed}/${day.adherence.planned} done` : isToday ? "today" : past ? "rest" : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
            <Legend
              items={[
                { label: "Deadline", color: "var(--saffron)" },
                { label: "Milestone", color: "var(--sky)" },
                { label: "Exam", color: "var(--coral)" },
                { label: "Workout", color: "var(--mint)" },
                { label: "Task", color: "var(--ink-3)" },
              ]}
            />
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Focus sessions ───────────── */

function Focus() {
  return (
    <Module
      framed
      title="Focus sessions"
      subtitle="This week · study and coding sessions by day"
      grow
      skeleton={{ rows: 5 }}
      actions={() => (
        <MethodInfo label="focus sessions">
          A focus session is a logged study or coding block. Totals add up session minutes. Planned versus actual length is
          not tracked yet, so the Discipline attribute leaves out its focus signal (20% of its weight).
        </MethodInfo>
      )}
      empty={{ icon: Hourglass, title: "No focus sessions this week", description: "Start a focus session or log one after the fact." }}
    >
      {(d) => {
        const ws = d.productivity.week.map((w) => w.date);
        const today = startOfDay(d.now).getTime();
        const byDay = ws.map((day) => {
          const items = d.productivity.focusSessions.filter((s) => startOfDay(s.start).getTime() === day.getTime()).sort((a, b) => a.start.getTime() - b.start.getTime());
          return { day, items, total: items.reduce((a, s) => a + s.minutes, 0) };
        });
        const max = Math.max(...byDay.map((b) => b.total), 60);
        return (
          <div className="flex flex-col gap-2">
            {byDay.map((b) => {
              const future = b.day.getTime() > today;
              return (
                <div key={b.day.getTime()} className={cn("flex items-center gap-3", future && "opacity-50")}>
                  <span className="w-12 shrink-0 text-xs text-ink-3">{b.day.getTime() === today ? "Today" : dayLabel(b.day)}</span>
                  <div className="flex h-7 flex-1 items-center gap-[3px]">
                    {b.items.length ? (
                      b.items.map((s) => (
                        <span
                          key={s.id}
                          title={`${formatTime(s.start)} · ${s.label} · ${s.minutes} min`}
                          className={cn("h-full truncate rounded-[6px] px-2 text-[10px] leading-7 text-base", s.kind === "study" ? "bg-sky" : "bg-lilac")}
                          style={{ width: `${(s.minutes / max) * 100}%` }}
                        >
                          {formatTime(s.start)} {s.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-2xs text-ink-3">{future ? "Upcoming" : "No sessions"}</span>
                    )}
                  </div>
                  <span className="num w-14 shrink-0 text-right text-2xs text-ink-2">{b.total ? `${(b.total / 60).toFixed(1)} h` : "—"}</span>
                </div>
              );
            })}
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <Legend items={[{ label: "Study", color: "var(--sky)" }, { label: "Coding", color: "var(--lilac)" }]} />
              <span className="ml-auto text-2xs text-ink-3">Block width = session length</span>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Habits ───────────── */

function Habits() {
  return (
    <Module
      framed
      title="Habits & routines"
      subtitle="Last 28 days · streak counts consecutive done days"
      className="xl:col-span-5"
      skeleton={{ rows: 3 }}
      empty={{ icon: Repeat, title: "No habits yet", description: "Add a small daily routine to track it here.", action: "Add habit" }}
    >
      {(d) => (
        <ul className="flex flex-col gap-4">
          {d.productivity.habits.map((h) => (
            <li key={h.id}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{h.name}</span>
                <span className="num text-2xs text-ink-3">{Math.round(h.rate28 * 100)}%</span>
                <Chip tone={h.streak >= 3 ? "mint" : "neutral"}>
                  <span>
                    <span className="num">{h.streak}</span>-day streak
                  </span>
                </Chip>
              </div>
              <div className="flex gap-[3px]" aria-label={`${h.name}: done ${Math.round(h.rate28 * 100)} percent of the last 28 days`}>
                {h.days.map((v, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-3.5 flex-1 rounded-[3px]",
                      v === null ? "border border-dashed border-ink-3" : v ? "bg-mint" : "bg-well-strong",
                    )}
                  />
                ))}
              </div>
            </li>
          ))}
          <p className="flex flex-wrap gap-x-3 text-2xs text-ink-3">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-mint" aria-hidden /> Done
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-well-strong" aria-hidden /> Not done
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-ink-3" aria-hidden /> Today, open
            </span>
          </p>
        </ul>
      )}
    </Module>
  );
}

/* ───────────── Screen time ───────────── */

function ScreenTime() {
  return (
    <Module
      framed
      title="Screen time vs focus time"
      subtitle="Last 14 days · minutes per day · screen time is entered manually"
      className="xl:col-span-7"
      skeleton={{ rows: 1, block: true }}
      empty={{ icon: MonitorSmartphone, title: "No screen time entered", description: "Enter daily screen time or import it to compare with focus time." }}
    >
      {(d) => {
        const rows = d.productivity.screen.map((x) => ({ label: dayLabel(x.date), screen: x.minutes, focus: x.focusMinutes }));
        const missing = rows.filter((r) => r.screen === null).length;
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <Legend items={[{ label: "Screen time", color: "var(--coral)" }, { label: "Focus time", color: "var(--sky)" }]} />
              <span className="text-2xs text-ink-3">{missing} days not entered (blank)</span>
              <Link href="/analytics" className="ml-auto text-xs text-ink-2 hover:text-saffron">
                See the correlation in Analytics →
              </Link>
            </div>
            <div className="h-56" role="img" aria-label="Daily screen time and focus time in minutes over the last 14 days">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -10 }} barCategoryGap="24%" barGap={2}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} width={44} unit="m" />
                  <Tooltip
                    cursor={{ fill: "var(--well)", opacity: 0.6 }}
                    content={(p) => <ChartTip active={p.active} label={p.label as string} rows={p.payload} format={(v) => `${Math.round(v)} min`} />}
                  />
                  <RBar dataKey="screen" name="Screen time" fill="var(--coral)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                  <RBar dataKey="focus" name="Focus time" fill="var(--sky)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

export function ProductivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productivity"
        description="Daily planning, focus, habits and deadlines. Consistency is measured against what you planned, not how busy you were."
        live={["Plan"]}
      />
      <StatStrip
        labels={["Planned items done, 7 days", "Focus time this week", "Habit completion, 28 days", "Screen time, 7-day average"]}
        stats={(d) => {
          const p = d.productivity;
          const r = p.completion7.planned ? p.completion7.completed / p.completion7.planned : null;
          const rp = p.completionPrev7.planned ? p.completionPrev7.completed / p.completionPrev7.planned : null;
          const focusMin = p.focusSessions.reduce((a, s) => a + s.minutes, 0);
          const habit = mean(p.habits.map((h) => h.rate28)) ?? 0;
          const scr = p.screen.slice(-7).map((x) => x.minutes).filter((x): x is number => x !== null);
          const scrPrev = p.screen.slice(0, 7).map((x) => x.minutes).filter((x): x is number => x !== null);
          const s7 = mean(scr);
          const s7p = mean(scrPrev);
          return [
            {
              label: "Planned items done, 7 days",
              value: r === null ? "—" : `${Math.round(r * 100)}%`,
              note: (
                <span>
                  {p.completion7.completed}/{p.completion7.planned} ·{" "}
                  {r !== null && rp !== null ? <Change now={Math.round(r * 100)} prev={Math.round(rp * 100)} suffix="pts vs prior 7" mode="abs" /> : "no prior data"}
                </span>
              ),
            },
            {
              label: "Focus time this week",
              value: (focusMin / 60).toFixed(1),
              unit: "h",
              accent: true,
              note: <Change now={focusMin} prev={p.focusPrevWeekMinutes} suffix="vs same days last week" />,
            },
            { label: "Habit completion, 28 days", value: `${Math.round(habit * 100)}%`, note: `${p.habits.length} habits · today not scored` },
            {
              label: "Screen time, 7-day average",
              value: s7 === null ? "—" : `${Math.floor(s7 / 60)}h ${String(Math.round(s7 % 60)).padStart(2, "0")}m`,
              note: <Change now={s7} prev={s7p} suffix="vs prior 7 · entered days" invert />,
            },
          ];
        }}
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <LiveTasks className="xl:col-span-5" />
        <div className="flex flex-col gap-5 xl:col-span-7">
          <Week />
          <Focus />
        </div>
        <Habits />
        <ScreenTime />
      </div>
    </div>
  );
}
