import { addDays, startOfDay, weekdayIndex } from "../dates";
import { computeForm, trendOf } from "../progression";
import { round1, type SampleDay } from "../sample-data";
import { CORRELATION_MIN_N, mean, pearson } from "../stats";
import type { StrengthWeek, XpEvent } from "../types";
import type { FitnessData } from "./fitness";
import { completeWeeks, inRange, type FocusSession } from "./shared";

export interface SummaryRow {
  key: string;
  label: string;
  unit: string;
  current: number | null;
  previous: number | null;
  decimals: number;
}
export interface PeriodSummary {
  currentLabel: string;
  previousLabel: string;
  rows: SummaryRow[];
}
export interface Correlation {
  points: { x: number; y: number }[];
  r: number | null;
  n: number;
  enough: boolean;
}
export interface TrendItem {
  id: string;
  kind: "up" | "down" | "plateau" | "flat";
  title: string;
  detail: string;
  method: string;
}
export interface AnalyticsData {
  week: PeriodSummary;
  month: PeriodSummary;
  trends: TrendItem[];
  heatmap: { blocks: string[]; minutes: number[][]; max: number; days: number };
  sleepStudy: Correlation;
  sleepLift: Correlation;
  screenFocus: Correlation;
  volumeStrength: { weeks: { weekStart: Date; volumeT: number; index: number | null }[]; r: number | null; n: number };
}

const corr = (points: { x: number; y: number }[]): Correlation => ({
  points,
  r: pearson(points),
  n: points.length,
  enough: points.length >= CORRELATION_MIN_N,
});

export const HEAT_BLOCKS = ["06–09", "09–12", "12–15", "15–18", "18–21", "21–24"];

export function buildAnalytics(
  now: Date,
  days: SampleDay[],
  events: XpEvent[],
  sessions: FocusSession[],
  fitness: FitnessData,
  strengthWeeks: StrengthWeek[],
  screenMinutes: (number | null)[],
): AnalyticsData {
  const today = startOfDay(now);

  const summarize = (xs: SampleDay[], start: Date, end: Date): Record<string, number | null> => {
    const sleep = mean(xs.map((d) => d.sleepH).filter((x): x is number => x !== null));
    const steps = mean(xs.map((d) => d.steps).filter((x): x is number => x !== null));
    const workouts = fitness.sessions.filter((s) => s.date >= start && s.date < end);
    return {
      study: xs.reduce((a, d) => a + d.studyMin, 0) / 60,
      coding: xs.reduce((a, d) => a + d.codingMin, 0) / 60,
      dsa: xs.reduce((a, d) => a + d.dsa.length, 0),
      workouts: workouts.length,
      volume: workouts.reduce((a, s) => a + s.volume, 0) / 1000,
      run: xs.reduce((a, d) => a + (d.run?.km ?? 0), 0),
      sleep,
      steps,
      onPlan: xs.filter((d) => d.planned > 0 && d.completed / d.planned >= 0.8).length,
      xp: events.filter((e) => e.at >= start && e.at < end).reduce((a, e) => a + e.amount, 0),
    };
  };
  const ROWS: Omit<SummaryRow, "current" | "previous">[] = [
    { key: "study", label: "Focused study", unit: "h", decimals: 1 },
    { key: "coding", label: "Coding", unit: "h", decimals: 1 },
    { key: "dsa", label: "DSA problems solved", unit: "", decimals: 0 },
    { key: "workouts", label: "Workouts", unit: "", decimals: 0 },
    { key: "volume", label: "Training volume", unit: "t", decimals: 1 },
    { key: "run", label: "Running distance", unit: "km", decimals: 1 },
    { key: "sleep", label: "Average sleep", unit: "h", decimals: 1 },
    { key: "steps", label: "Average steps", unit: "", decimals: 0 },
    { key: "onPlan", label: "Days on plan", unit: "", decimals: 0 },
    { key: "xp", label: "XP earned", unit: "XP", decimals: 0 },
  ];
  const period = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date, labels: [string, string]): PeriodSummary => {
    const a = summarize(inRange(days, aStart, aEnd), aStart, aEnd);
    const b = summarize(inRange(days, bStart, bEnd), bStart, bEnd);
    return { currentLabel: labels[0], previousLabel: labels[1], rows: ROWS.map((r) => ({ ...r, current: a[r.key], previous: b[r.key] })) };
  };
  const [w1, w2] = completeWeeks(now, 2).reverse();
  const week = period(w1.start, w1.end, w2.start, w2.end, ["Last week", "Week before"]);
  const m1s = addDays(today, -28);
  const month = period(m1s, today, addDays(m1s, -28), m1s, ["Last 28 days", "Prior 28 days"]);

  /* Trends and plateaus (same rules as the Overview) */
  const trends: TrendItem[] = [];
  const formItem = (id: string, label: string, series: (number | null)[], kind: "volume" | "level", unit: string, digits = 0) => {
    const f = computeForm(series, kind);
    const dir = trendOf(f);
    if (f.status !== "ok" || dir === null) return;
    const pct = Math.round(f.value * 100);
    trends.push({
      id,
      kind: dir === "up" ? "up" : dir === "down" ? "down" : "flat",
      title: dir === "flat" ? `${label} stable` : `${label} ${dir} ${Math.abs(pct)}%`,
      detail: `${f.recentMean.toFixed(digits)} ${unit} over the last 14 days vs ${f.baselineMean.toFixed(digits)} ${unit} in the prior 28.`,
      method: `Form rule: mean of the last 14 days vs the prior 28-day baseline (${kind === "volume" ? "days without a record count as 0" : "recorded days only"}). Within ±5% is stable.`,
    });
  };
  formItem("t-coding", "Coding time", days.map((d) => (d.codingMin > 0 ? d.codingMin : null)), "volume", "min/day");
  formItem("t-study", "Study time", days.map((d) => (d.studyMin > 0 ? d.studyMin : null)), "volume", "min/day");
  formItem("t-speed", "Running speed", days.map((d) => (d.run ? d.run.km / (d.run.minutes / 60) : null)), "level", "km/h", 1);
  const sq = strengthWeeks.map((w) => w.squat);
  const recentBest = Math.max(...sq.slice(-3).filter((x): x is number => x !== null), 0);
  const priorBest = Math.max(...sq.slice(0, -3).filter((x): x is number => x !== null), 0);
  if (priorBest > 0 && recentBest > 0 && recentBest <= priorBest) {
    trends.push({
      id: "t-squat",
      kind: "plateau",
      title: "Back squat plateau",
      detail: `Best est. 1RM of the last 3 weeks is ${recentBest} kg; the 5 weeks before reached ${priorBest} kg.`,
      method: "Plateau rule: the best est. 1RM in the most recent 3 weeks does not exceed the best from the 5 weeks before.",
    });
  }

  /* Productive time of day: focused minutes by weekday × 3-hour block, last 28 days */
  const since = addDays(today, -28);
  const minutes = Array.from({ length: 7 }, () => HEAT_BLOCKS.map(() => 0));
  sessions
    .filter((s) => s.start >= since && s.start < today)
    .forEach((s) => {
      const b = Math.min(5, Math.max(0, Math.floor((s.start.getHours() - 6) / 3)));
      minutes[weekdayIndex(s.start)][b] += s.minutes;
    });
  const max = Math.max(...minutes.flat());

  /* Correlations — always labelled as correlations */
  const last28 = days.slice(-29, -1);
  const sleepStudy = corr(last28.filter((d) => d.sleepH !== null).map((d) => ({ x: d.sleepH as number, y: d.studyMin })));

  const bestSoFar: Record<string, number> = {};
  const liftPts: { x: number; y: number }[] = [];
  days.forEach((d) => {
    if (!d.lift) return;
    const prev = bestSoFar[d.lift.lift];
    if (prev !== undefined && d.sleepH !== null) liftPts.push({ x: d.sleepH, y: round1((d.lift.e1rm / prev) * 100) });
    bestSoFar[d.lift.lift] = Math.max(prev ?? 0, d.lift.e1rm);
  });
  const sleepLift = corr(liftPts);

  const screenFocus = corr(
    days
      .slice(-29, -1)
      .map((d, i) => ({ s: screenMinutes[screenMinutes.length - 29 + i], f: d.studyMin + d.codingMin }))
      .filter((p): p is { s: number; f: number } => p.s !== null)
      .map((p) => ({ x: p.s, y: p.f })),
  );

  // Weekly volume (t) vs strength index (mean of tracked lifts' weekly best e1RM, % of the first week)
  const first = (k: keyof Omit<StrengthWeek, "weekStart">) => strengthWeeks.find((w) => w[k] !== null)?.[k] as number | undefined;
  const base = { bench: first("bench"), squat: first("squat"), deadlift: first("deadlift") };
  const vsWeeks = fitness.weekly.map((w, i) => {
    const sw = strengthWeeks[i];
    const parts = (["bench", "squat", "deadlift"] as const)
      .map((k) => (sw[k] !== null && base[k] ? (sw[k] as number) / (base[k] as number) : null))
      .filter((x): x is number => x !== null);
    const idx = mean(parts);
    return { weekStart: w.weekStart, volumeT: round1(w.volume / 1000), index: idx === null ? null : round1(idx * 100) };
  });
  const vsPts = vsWeeks.filter((w) => w.index !== null).map((w) => ({ x: w.volumeT, y: w.index as number }));

  return {
    week,
    month,
    trends,
    heatmap: { blocks: HEAT_BLOCKS, minutes, max, days: 28 },
    sleepStudy,
    sleepLift,
    screenFocus,
    volumeStrength: { weeks: vsWeeks, r: pearson(vsPts), n: vsPts.length },
  };
}
