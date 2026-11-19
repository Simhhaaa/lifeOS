"use client";

import { Bar as RBar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Footprints, HeartPulse, ListChecks, Moon, Smile } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { AXIS, ChartTip, GRID, Legend } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/states";
import { Module } from "@/components/dashboard/module";
import { LiveCheckIn } from "@/components/live/live-checkin";
import { PageHeader } from "@/components/page/page-header";
import { Change, StatStrip } from "@/components/page/stat-strip";
import { WEEKDAY_SHORT, formatRelativeDay, weekdayIndex } from "@/lib/dates";
import { SLEEP_TARGET_H } from "@/lib/progression";

const fmtH = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
const STEPS_TARGET = 8000;
const dayLabel = (d: Date) => `${WEEKDAY_SHORT[weekdayIndex(d)].slice(0, 2)} ${d.getDate()}`;

/* ───────────── Sleep ───────────── */

function Sleep() {
  return (
    <Module
      framed
      title="Sleep"
      subtitle={`Last 28 nights · hours, with self-rated quality 1–5 · target ${SLEEP_TARGET_H} h`}
      className="xl:col-span-8"
      skeleton={{ rows: 1, block: true }}
      empty={{ icon: Moon, title: "No sleep logged", description: "Log last night’s sleep in the daily check-in.", action: "Daily check-in" }}
    >
      {(d) => {
        const rows = d.health.days.map((x) => ({ label: dayLabel(x.date), hours: x.sleepH, q: x.sleepQuality, met: x.sleepH !== null && x.sleepH >= SLEEP_TARGET_H }));
        const logged = rows.filter((r) => r.hours !== null);
        const met = logged.filter((r) => r.met).length;
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-2">
              <span>
                <span className="num text-ink">{met}</span> of {logged.length} logged nights met the target
              </span>
              <span>
                <span className="num text-ink">{rows.length - logged.length}</span> nights not logged
              </span>
              <span className="ml-auto">
                <Legend
                  items={[
                    { label: `≥ ${SLEEP_TARGET_H} h`, color: "var(--sky)" },
                    { label: "Below target", color: "color-mix(in srgb, var(--sky) 40%, transparent)" },
                    { label: "Target", color: "var(--ref)", dashed: true },
                  ]}
                />
              </span>
            </div>
            <div className="h-56" role="img" aria-label={`Sleep hours for the last 28 nights; ${met} of ${logged.length} logged nights met the ${SLEEP_TARGET_H} hour target`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: -16 }} barCategoryGap="22%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} interval={3} />
                  <YAxis {...AXIS} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} unit="h" width={42} />
                  <ReferenceLine y={SLEEP_TARGET_H} stroke="var(--ref)" strokeDasharray="4 4" />
                  <Tooltip
                    cursor={{ fill: "var(--well)", opacity: 0.6 }}
                    content={(p) => {
                      const r = p.payload?.[0]?.payload as (typeof rows)[number] | undefined;
                      return (
                        <ChartTip
                          active={p.active}
                          label={`${p.label}${r?.q ? ` · quality ${r.q}/5` : ""}`}
                          rows={p.payload}
                          format={(v) => fmtH(v)}
                        />
                      );
                    }}
                  />
                  <RBar dataKey="hours" name="Sleep" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {rows.map((r) => (
                      <Cell key={r.label} fill={r.met ? "var(--sky)" : "color-mix(in srgb, var(--sky) 40%, transparent)"} />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-3 pl-[26px]">
              <span className="w-12 shrink-0 text-2xs text-ink-3">Quality</span>
              <div className="flex flex-1 gap-[3px]" aria-label="Self-rated sleep quality per night, 1 to 5">
                {rows.map((r) => (
                  <span
                    key={r.label}
                    title={`${r.label}: ${r.q ?? "not logged"}`}
                    className={cn("h-2 flex-1 rounded-full", r.q === null ? "bg-well" : "bg-lilac")}
                    style={r.q === null ? undefined : { opacity: 0.2 + (r.q / 5) * 0.8 }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Steps & runs ───────────── */

function Activity28() {
  return (
    <Module
      framed
      title="Steps & activity"
      subtitle={`Daily steps, last 28 days · target ${STEPS_TARGET.toLocaleString()} · logged runs`}
      className="xl:col-span-7"
      skeleton={{ rows: 1, block: true }}
      empty={{ icon: Footprints, title: "No activity logged", description: "Enter steps or import them from a supported source." }}
    >
      {(d) => {
        const rows = d.health.days.map((x) => ({ label: dayLabel(x.date), steps: x.steps, met: (x.steps ?? 0) >= STEPS_TARGET }));
        return (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="h-52" role="img" aria-label="Daily steps for the last 28 days with an 8,000 step target line">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: -6 }} barCategoryGap="22%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} interval={6} />
                  <YAxis {...AXIS} width={40} tickFormatter={(v: number) => `${v / 1000}k`} />
                  <ReferenceLine y={STEPS_TARGET} stroke="var(--ref)" strokeDasharray="4 4" />
                  <Tooltip
                    cursor={{ fill: "var(--well)", opacity: 0.6 }}
                    content={(p) => <ChartTip active={p.active} label={p.label as string} rows={p.payload} format={(v) => v.toLocaleString()} />}
                  />
                  <RBar dataKey="steps" name="Steps" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {rows.map((r) => (
                      <Cell key={r.label} fill={r.met ? "var(--mint)" : "color-mix(in srgb, var(--mint) 40%, transparent)"} />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-xs text-ink-2">Runs · last 28 days</p>
              <ul className="flex flex-col">
                {d.health.runs.slice(0, 6).map((r) => (
                  <li key={r.date.getTime()} className="num flex items-center gap-3 border-t border-edge/70 py-2 text-xs first:border-t-0">
                    <span className="w-16 text-2xs text-ink-3">{formatRelativeDay(r.date, d.now)}</span>
                    <span className="flex-1 text-ink">{r.km} km</span>
                    <span className="text-ink-3">{Math.round(r.minutes)} min</span>
                    <span className="w-20 text-right text-ink-2">
                      {Math.floor(r.pace)}:{String(Math.round((r.pace % 1) * 60)).padStart(2, "0")} /km
                    </span>
                  </li>
                ))}
              </ul>
              <p className="num mt-2 text-2xs text-ink-3">
                {d.health.runs.length} runs · {d.health.runs.reduce((a, r) => a + r.km, 0).toFixed(1)} km in 28 days
              </p>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Mood, energy, recovery ───────────── */

function Feelings() {
  return (
    <Module
      framed
      title="Mood, energy & recovery"
      subtitle="Self-rated 1–5 · last 14 days"
      className="xl:col-span-5"
      skeleton={{ rows: 1, block: true }}
      empty={{ icon: Smile, title: "No ratings yet", description: "Rate mood, energy and recovery in the daily check-in." }}
    >
      {(d) => {
        const rows = d.health.days.slice(-14).map((x) => ({ label: dayLabel(x.date), mood: x.mood, energy: x.energy, recovery: x.recovery }));
        return (
          <div className="flex flex-col gap-3">
            <Legend
              items={[
                { label: "Mood", color: "var(--lilac)" },
                { label: "Energy", color: "var(--saffron)" },
                { label: "Recovery", color: "var(--mint)" },
              ]}
            />
            <div className="h-48" role="img" aria-label="Mood, energy and recovery ratings from 1 to 5 over the last 14 days">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} interval={3} />
                  <YAxis {...AXIS} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={40} />
                  <Tooltip
                    cursor={{ stroke: "var(--edge-strong)" }}
                    content={(p) => <ChartTip active={p.active} label={p.label as string} rows={p.payload} format={(v) => `${v}/5`} />}
                  />
                  <Line dataKey="mood" name="Mood" stroke="var(--lilac)" strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
                  <Line dataKey="energy" name="Energy" stroke="var(--saffron)" strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
                  <Line dataKey="recovery" name="Recovery" stroke="var(--mint)" strokeWidth={1.75} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-2xs text-ink-3">Gaps are days without a check-in. Ratings are subjective and only compared with your own history.</p>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Not logged + inputs ───────────── */

function RestingHr() {
  return (
    <Module
      framed
      title="Resting heart rate"
      subtitle="Manual entry or import from a supported source"
      className="xl:col-span-4 xl:self-start"
      skeleton={{ rows: 2 }}
      empty={{ icon: HeartPulse, title: "Not logged", description: "Add resting heart rate manually or import it." }}
    >
      {() => (
        <EmptyState
          icon={HeartPulse}
          title="No resting heart rate yet"
          description="It adds 15% of the Vitality formula. Until it’s logged, Vitality is scored on the other signals and shows its lower coverage."
        />
      )}
    </Module>
  );
}

function Hydration() {
  return (
    <Module
      framed
      title="Hydration"
      subtitle="Litres per day against your own target"
      className="xl:col-span-4 xl:self-start"
      skeleton={{ rows: 2 }}
      empty={{ icon: Droplets, title: "Not logged", description: "Log water intake to track hydration." }}
    >
      {() => (
        <EmptyState
          icon={Droplets}
          title="No hydration logs yet"
          description="Also 15% of Vitality. Log it in the daily check-in when you want it counted."
        />
      )}
    </Module>
  );
}

function Inputs() {
  return (
    <Module
      framed
      title="What’s tracked here"
      subtitle="Inputs, where they come from and when they were last logged"
      className="xl:col-span-4"
      skeleton={{ rows: 5 }}
      empty={{ icon: ListChecks, title: "Nothing logged", description: "Your health inputs and their sources appear here." }}
    >
      {(d) => {
        const last = (f: (x: (typeof d.health.days)[number]) => unknown) => {
          const hit = [...d.health.days].reverse().find((x) => f(x) !== null && f(x) !== undefined);
          if (!hit) return "never";
          const rel = formatRelativeDay(hit.date, d.now);
          return hit.date.getTime() === d.health.days[d.health.days.length - 1].date.getTime() ? "Today" : rel;
        };
        const rows = [
          { label: "Sleep and quality", source: "Daily check-in", last: last((x) => x.sleepH) },
          { label: "Energy, mood, recovery", source: "Daily check-in", last: last((x) => x.energy) },
          { label: "Steps", source: "Manual or import", last: last((x) => x.steps) },
          { label: "Resting heart rate", source: "Manual or import", last: "never" },
          { label: "Hydration", source: "Daily check-in", last: "never" },
        ];
        return (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center gap-3 border-t border-edge/70 py-2 text-xs first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink">{r.label}</span>
                    <span className="block text-2xs text-ink-3">{r.source}</span>
                  </span>
                  {r.last === "never" ? <Chip tone="neutral">Not logged</Chip> : <span className="num text-2xs text-ink-2">{r.last}</span>}
                </li>
              ))}
            </ul>
            <p className="text-2xs text-ink-3">By design, LifeOS has no calorie, protein or meal tracking.</p>
          </div>
        );
      }}
    </Module>
  );
}

export function HealthPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Health & recovery"
        description="Sleep, activity, mood, energy and recovery from your own logs. This is a self-tracking view, not medical advice."
        live={["Readiness"]}
      />
      <StatStrip
        labels={["Sleep, 14-night average", "Steps, 14-day average", "Runs, 28 days", "Resting heart rate"]}
        stats={(d) => {
          const h = d.health;
          return [
            {
              label: "Sleep, 14-night average",
              value: h.sleepAvg14 === null ? "—" : fmtH(h.sleepAvg14),
              note: <Change now={h.sleepAvg14} prev={h.prevSleepAvg14} suffix={`vs prior 14 · target ${SLEEP_TARGET_H} h`} />,
            },
            {
              label: "Steps, 14-day average",
              value: h.stepsAvg14 === null ? "—" : Math.round(h.stepsAvg14).toLocaleString(),
              note: <Change now={h.stepsAvg14} prev={h.prevStepsAvg14} suffix={`vs prior 14 · target ${STEPS_TARGET.toLocaleString()}`} />,
            },
            {
              label: "Runs, 28 days",
              value: String(h.runs.length),
              note: `${h.runs.reduce((a, r) => a + r.km, 0).toFixed(1)} km logged`,
            },
            { label: "Resting heart rate", value: "—", note: "not logged yet" },
          ];
        }}
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <Sleep />
        <LiveCheckIn className="xl:col-span-4" />
        <Activity28 />
        <Feelings />
        <RestingHr />
        <Hydration />
        <Inputs />
      </div>
    </div>
  );
}
