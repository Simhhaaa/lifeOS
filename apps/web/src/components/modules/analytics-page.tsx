"use client";

import { useState } from "react";
import {
  Bar as RBar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ToggleGroup } from "radix-ui";
import { ChartScatter, Clock, MoveDownRight, MoveRight, MoveUpRight, Table2, TrendingUp } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip, type Tone } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { AXIS, ChartTip, GRID, Legend } from "@/components/ui/chart";
import { Module } from "@/components/dashboard/module";
import { PageHeader } from "@/components/page/page-header";
import { WEEKDAY_SHORT, formatShortDate } from "@/lib/dates";
import type { Correlation, PeriodSummary, TrendItem } from "@/lib/sample/analytics";
import { CORRELATION_MIN_N, correlationWord } from "@/lib/stats";

/* ───────────── Summary ───────────── */

function fmt(v: number | null, decimals: number, unit: string) {
  if (v === null) return "—";
  const n = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return unit && unit !== "XP" ? `${n} ${unit}` : unit === "XP" ? `${n}` : n;
}

function SummaryTable({ week, month }: { week: PeriodSummary; month: PeriodSummary }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const s = period === "week" ? week : month;
  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup.Root
        type="single"
        value={period}
        onValueChange={(v) => v && setPeriod(v as "week" | "month")}
        aria-label="Summary period"
        className="flex w-fit rounded-full bg-well p-0.5"
      >
        {[
          { v: "week", l: "Weekly" },
          { v: "month", l: "Monthly (28 days)" },
        ].map((o) => (
          <ToggleGroup.Item
            key={o.v}
            value={o.v}
            className="h-7 rounded-full px-3 text-xs text-ink-2 transition hover:text-ink data-[state=on]:bg-ink data-[state=on]:text-base"
          >
            {o.l}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          {s.currentLabel} compared with {s.previousLabel}
        </caption>
        <thead>
          <tr className="text-2xs text-ink-3">
            <th scope="col" className="pb-2 font-normal">Metric</th>
            <th scope="col" className="pb-2 text-right font-normal">{s.currentLabel}</th>
            <th scope="col" className="pb-2 text-right font-normal">{s.previousLabel}</th>
            <th scope="col" className="pb-2 text-right font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => {
            const diff = r.current !== null && r.previous !== null ? r.current - r.previous : null;
            const pct = diff !== null && r.previous ? Math.round((diff / r.previous) * 100) : null;
            const flat = pct !== null && Math.abs(pct) < 5;
            const Icon = pct === null ? null : flat ? MoveRight : pct > 0 ? MoveUpRight : MoveDownRight;
            return (
              <tr key={r.key} className="border-t border-edge/70">
                <td className="py-2 text-ink-2">{r.label}</td>
                <td className="num py-2 text-right text-ink">{fmt(r.current, r.decimals, r.unit)}</td>
                <td className="num py-2 text-right text-ink-3">{fmt(r.previous, r.decimals, r.unit)}</td>
                <td className={cn("num py-2 text-right text-xs", flat || pct === null ? "text-ink-3" : pct > 0 ? "text-mint" : "text-coral")}>
                  <span className="inline-flex items-center gap-0.5">
                    {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden />}
                    {pct === null ? "n/a" : flat ? "same" : `${pct > 0 ? "+" : ""}${pct}%`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-2xs text-ink-3">
        Green and coral mark direction only, within ±5% counts as about the same. Fewer hours or less training can be the right
        call; the summary doesn’t judge.
      </p>
    </div>
  );
}

function Summary() {
  return (
    <Module
      framed
      title="Summary"
      subtitle="Complete weeks (Mon–Sun) or the last 28 days, each against the period before"
      className="xl:col-span-7"
      skeleton={{ rows: 8 }}
      empty={{ icon: Table2, title: "No summary yet", description: "Summaries need at least two complete weeks of logs." }}
    >
      {(d) => <SummaryTable week={d.analytics.week} month={d.analytics.month} />}
    </Module>
  );
}

/* ───────────── Trends & plateaus ───────────── */

const TREND: Record<TrendItem["kind"], { label: string; tone: Tone }> = {
  up: { label: "Up", tone: "mint" },
  down: { label: "Down", tone: "coral" },
  flat: { label: "Stable", tone: "neutral" },
  plateau: { label: "Plateau", tone: "saffron" },
};

function Trends() {
  return (
    <Module
      framed
      title="Trends & plateaus"
      subtitle="Detected with the same rules as form · last 14 days vs prior 28"
      skeleton={{ rows: 5 }}
      empty={{ icon: TrendingUp, title: "No trends yet", description: "Trends need about 6 weeks of history." }}
    >
      {(d) =>
        d.analytics.trends.length ? (
          <ul className="flex flex-col gap-2">
            {d.analytics.trends.map((t) => (
              <li key={t.id} className="rounded-box bg-well p-3.5">
                <div className="flex items-center gap-2">
                  <Chip tone={TREND[t.kind].tone}>{TREND[t.kind].label}</Chip>
                  <p className="text-sm text-ink">{t.title}</p>
                </div>
                <p className="mt-1.5 text-xs text-ink-2">{t.detail}</p>
                <details className="mt-1.5 text-2xs text-ink-3">
                  <summary className="w-fit cursor-pointer list-none underline decoration-dotted underline-offset-2 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
                    Method
                  </summary>
                  <p className="mt-1 leading-4">{t.method}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-3">No clear trend or plateau right now.</p>
        )
      }
    </Module>
  );
}

/* ───────────── Time of day ───────────── */

function TimeOfDay() {
  return (
    <Module
      framed
      title="Productive time of day"
      subtitle="Focused study and coding minutes by weekday and start time · last 28 days"
      className="xl:col-span-12"
      skeleton={{ rows: 1, block: true }}
      empty={{ icon: Clock, title: "No sessions yet", description: "Time-of-day patterns appear after a few weeks of logged sessions." }}
    >
      {(d) => {
        const h = d.analytics.heatmap;
        let best = { day: 0, block: 0, v: -1 };
        h.minutes.forEach((row, i) => row.forEach((v, j) => v > best.v && (best = { day: i, block: j, v })));
        const blockTotals = h.blocks.map((_, j) => h.minutes.reduce((a, row) => a + row[j], 0));
        const total = blockTotals.reduce((a, b) => a + b, 0) || 1;
        return (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <div role="table" aria-label="Focused minutes by weekday and time block" className="grid grid-cols-[2.5rem_repeat(6,minmax(0,1fr))] gap-1.5">
                <span role="columnheader" />
                {h.blocks.map((b) => (
                  <span key={b} role="columnheader" className="num text-center text-[10px] text-ink-3">
                    {b}
                  </span>
                ))}
                {h.minutes.map((row, i) => (
                  <div key={i} role="row" className="contents">
                    <span role="rowheader" className="self-center text-xs text-ink-3">
                      {WEEKDAY_SHORT[i]}
                    </span>
                    {row.map((v, j) => (
                      <span
                        key={j}
                        role="cell"
                        title={`${WEEKDAY_SHORT[i]} ${h.blocks[j]}: ${v} min`}
                        aria-label={`${WEEKDAY_SHORT[i]} ${h.blocks[j]}: ${v} minutes`}
                        className="grid h-8 place-items-center rounded-[8px] text-[10px]"
                        style={{
                          background: v ? `color-mix(in srgb, var(--sky) ${Math.round(15 + (v / h.max) * 85)}%, var(--well))` : "var(--well)",
                          color: v / h.max > 0.55 ? "var(--base)" : "var(--ink)",
                        }}
                      >
                        {v ? Math.round(v / 6) / 10 : ""}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-2xs text-ink-3">Cells show hours over 4 weeks. Darker means more focused time.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-box bg-well p-4">
                <p className="text-xs text-ink-3">Most focused slot</p>
                <p className="mt-1 font-display text-[24px] leading-7 font-semibold tracking-[-0.03em] text-ink">
                  {WEEKDAY_SHORT[best.day]} · {h.blocks[best.block]}
                </p>
                <p className="num text-2xs text-ink-3">{Math.round((best.v / 60) * 10) / 10} h over 4 weeks</p>
              </div>
              <div>
                <p className="mb-2 text-xs text-ink-2">Share of focused time by start time</p>
                <ul className="flex flex-col gap-1.5">
                  {h.blocks.map((b, j) => {
                    const pct = Math.round((blockTotals[j] / total) * 100);
                    return (
                      <li key={b} className="flex items-center gap-3 text-xs">
                        <span className="num w-12 shrink-0 text-ink-3">{b}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-well">
                          <span className="block h-full rounded-full bg-sky" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="num w-9 text-right text-ink-2">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="text-2xs text-ink-3">A pattern in your own logs, useful for planning deep work. Not a rule.</p>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Volume vs strength ───────────── */

function VolumeStrength() {
  return (
    <Module
      framed
      title="Training volume vs strength"
      subtitle="Weekly volume, t · strength index, % of week 1 · last 8 weeks"
      grow
      skeleton={{ rows: 1, block: true }}
      actions={() => (
        <MethodInfo label="strength index">
          Strength index = average of each tracked lift’s weekly best est. 1RM divided by its first week, as %. Volume = Σ
          load × reps of all working sets that week. r is the Pearson correlation between the two weekly series. With only
          8 weeks it is weak evidence; it’s a correlation, not a cause.
        </MethodInfo>
      )}
      empty={{ icon: ChartScatter, title: "Not enough training data", description: "Needs several weeks of logged sets." }}
    >
      {(d) => {
        const v = d.analytics.volumeStrength;
        const rows = v.weeks.map((w) => ({ label: formatShortDate(w.weekStart), volume: w.volumeT, index: w.index }));
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Legend items={[{ label: "Volume", color: "var(--lilac)" }, { label: "Strength index", color: "var(--saffron)" }]} />
              <span className="ml-auto">
                <RChip r={v.r} n={v.n} />
              </span>
            </div>
            <div className="h-56" role="img" aria-label="Weekly training volume as bars and strength index as a line over 8 weeks">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 6, right: 0, bottom: 0, left: -16 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} interval={1} />
                  <YAxis yAxisId="v" {...AXIS} width={40} unit="t" />
                  <YAxis yAxisId="i" orientation="right" {...AXIS} width={44} domain={["dataMin - 2", "dataMax + 2"]} unit="%" tickFormatter={(x: number) => String(Math.round(x))} />
                  <Tooltip
                    cursor={{ fill: "var(--well)", opacity: 0.6 }}
                    content={(p) => (
                      <ChartTip
                        active={p.active}
                        label={`Week of ${p.label}`}
                        rows={p.payload}
                        format={(x, name) => (name === "Volume" ? `${x.toFixed(1)} t` : `${x.toFixed(1)}%`)}
                      />
                    )}
                  />
                  <RBar yAxisId="v" dataKey="volume" name="Volume" fill="var(--lilac)" radius={[5, 5, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  <Line yAxisId="i" dataKey="index" name="Strength index" stroke="var(--saffron)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: "var(--saffron)" }} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Correlations ───────────── */

function RChip({ r, n }: { r: number | null; n: number }) {
  if (r === null || n < CORRELATION_MIN_N) return <Chip>Not enough data · n = {n}</Chip>;
  const word = correlationWord(r);
  return (
    <Chip tone={word === "weak" ? "neutral" : "sky"}>
      <span className="num">
        r = {r.toFixed(2)} · {word} · n = {n}
      </span>
    </Chip>
  );
}

function CorrCard({
  title,
  subtitle,
  data,
  x,
  y,
  reading,
  className,
}: {
  title: string;
  subtitle: string;
  data: (d: import("@/lib/world").World) => Correlation;
  x: { label: string; unit: string; domain?: [number | string, number | string] };
  y: { label: string; unit: string; domain?: [number | string, number | string] };
  reading: (c: Correlation) => string;
  className?: string;
}) {
  return (
    <Module
      framed
      title={title}
      subtitle={subtitle}
      className={className}
      skeleton={{ rows: 1, block: true }}
      actions={() => (
        <MethodInfo label="correlation">
          r is the Pearson correlation of the paired days shown (−1 to 1). |r| under 0.3 is weak, under 0.5 moderate,
          otherwise strong. Needs at least {CORRELATION_MIN_N} pairs. A correlation doesn’t show that one thing causes the
          other; other factors may drive both.
        </MethodInfo>
      )}
      empty={{ icon: ChartScatter, title: "Not enough pairs", description: `Needs at least ${CORRELATION_MIN_N} days with both values logged.` }}
    >
      {(d) => {
        const c = data(d);
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <RChip r={c.r} n={c.n} />
              <Chip tone="neutral">Correlation, not cause</Chip>
            </div>
            <div className="h-48" role="img" aria-label={`Scatter plot of ${y.label} against ${x.label}, ${c.n} points`}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 6, right: 6, bottom: 14, left: -10 }}>
                  <CartesianGrid {...GRID} vertical />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={x.label}
                    unit={x.unit}
                    {...AXIS}
                    domain={x.domain ?? ["auto", "auto"]}
                    label={{ value: x.label, position: "insideBottom", offset: -10, fill: "var(--ink-3)", fontSize: 11 }}
                  />
                  <YAxis type="number" dataKey="y" name={y.label} unit={y.unit} {...AXIS} width={48} domain={y.domain ?? ["auto", "auto"]} />
                  <ZAxis range={[36, 36]} />
                  <Tooltip
                    cursor={{ stroke: "var(--edge-strong)" }}
                    content={(p) => <ChartTip active={p.active} rows={p.payload} format={(v, name) => `${Math.round(v * 10) / 10}${name === x.label ? x.unit : y.unit}`} />}
                  />
                  <Scatter data={c.points} fill="var(--sky)" fillOpacity={0.75} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-ink-2">{reading(c)}</p>
          </div>
        );
      }}
    </Module>
  );
}

const describe = (c: Correlation, pos: string, neg: string) => {
  if (c.r === null || !c.enough) return "Not enough paired days to say anything yet.";
  const w = correlationWord(c.r);
  if (w === "weak") return "No clear relationship in this window.";
  return `A ${w} ${c.r > 0 ? "positive" : "negative"} relationship: ${c.r > 0 ? pos : neg}`;
};

export function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Weekly and monthly summaries, trends and plateaus, and patterns across areas. Correlations are labelled as correlations, never as causes, and nothing here is medical advice."
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <Summary />
        <div className="flex flex-col gap-5 xl:col-span-5">
          <Trends />
          <VolumeStrength />
        </div>
        <TimeOfDay />
        <CorrCard
          title="Sleep vs study"
          subtitle="Previous night’s sleep vs study minutes that day · last 28 days"
          className="xl:col-span-4"
          data={(d) => d.analytics.sleepStudy}
          x={{ label: "Sleep", unit: "h", domain: [5, 9] }}
          y={{ label: "Study", unit: "m" }}
          reading={(c) => describe(c, "on days after more sleep, study time tended to be longer.", "on days after more sleep, study time tended to be shorter.")}
        />
        <CorrCard
          title="Sleep vs workout performance"
          subtitle="Prior night’s sleep vs top set, % of that lift’s best so far"
          className="xl:col-span-4"
          data={(d) => d.analytics.sleepLift}
          x={{ label: "Sleep", unit: "h", domain: [5, 9] }}
          y={{ label: "Top set", unit: "%" }}
          reading={(c) => describe(c, "better-slept sessions tended to come closer to your best.", "better-slept sessions tended to fall further from your best.")}
        />
        <CorrCard
          title="Screen time vs focus time"
          subtitle="Entered screen time vs focused minutes, same day · last 28 days"
          className="xl:col-span-4"
          data={(d) => d.analytics.screenFocus}
          x={{ label: "Screen", unit: "m" }}
          y={{ label: "Focus", unit: "m" }}
          reading={(c) => describe(c, "days with more screen time also had more focus time.", "days with more screen time tended to have less focus time.")}
        />
      </div>
    </div>
  );
}
