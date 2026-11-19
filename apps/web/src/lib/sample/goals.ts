import { addDays, startOfDay } from "../dates";
import { SLEEP_TARGET_H } from "../progression";
import { plannedWorkoutToday, round1, type SampleDay } from "../sample-data";
import { mean, slope } from "../stats";
import type { Goal, Quest, StrengthWeek } from "../types";
import { PRIOR_DSA_SOLVED, dsaProblems, type Semester } from "./academics";
import type { FitnessData } from "./fitness";
import { completeWeeks, inRange } from "./shared";

export interface GoalMilestone {
  label: string;
  value: number;
  reached: Date | null;
}
export interface GoalDetail extends Goal {
  /** short name for lists, e.g. "Bench press" */
  short: string;
  module: "fitness" | "academics";
  milestones: GoalMilestone[];
  /** linear projection from recent rate (docs/progression-rules.md §9) */
  projection: { ratePerWeek: number | null; rateLabel: string; eta: Date | null; onTrack: boolean | null };
}
export interface Achievement {
  id: string;
  title: string;
  criteria: string;
  unlocked: Date | null;
  current: number;
  target: number;
  unit: string;
}
export interface Challenge {
  id: string;
  title: string;
  basis: string;
  rule: string;
  module: "fitness" | "academics" | "health";
}
export interface Objective {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}
export interface GoalsData {
  objectives: Objective[];
  quests: Quest[];
  goals: GoalDetail[];
  completedGoals: { title: string; reached: Date; detail: string }[];
  achievements: Achievement[];
  challenges: Challenge[];
}

/** DBMS units completed so far, days before today (sample). */
const DBMS_UNIT_DAYS_AGO = [70, 60, 48, 38, 27, 16, 5];

export function buildGoals(
  now: Date,
  days: SampleDay[],
  dashGoals: Goal[],
  quests: Quest[],
  strengthWeeks: StrengthWeek[],
  fitness: FitnessData,
  semesters: Semester[],
): GoalsData {
  const today = startOfDay(now);
  const bodyweight = (d: Date) => [...fitness.weighIns].reverse().find((w) => w.date <= d)?.kg ?? fitness.weighIns[0]?.kg ?? 72;

  /* Goals with milestones and a projection */
  const goals: GoalDetail[] = dashGoals.map((g) => {
    if (g.id === "g-bench") {
      const pts = strengthWeeks.map((w, i) => (w.bench === null ? null : { x: i, y: w.bench })).filter((p): p is { x: number; y: number } => p !== null);
      const rate = slope(pts);
      const eta = rate && rate > 0 ? addDays(today, Math.ceil(((g.target - g.current) / rate) * 7)) : null;
      const reach = (v: number) => fitness.lifts.bench.find((s) => s.e1rm >= v)?.date ?? null;
      return {
        ...g,
        short: "Bench press",
        module: "fitness" as const,
        milestones: [85, 90, 95].map((v) => ({ label: `${v} kg`, value: v, reached: reach(v) })),
        projection: { ratePerWeek: rate, rateLabel: rate === null ? "—" : `${rate >= 0 ? "+" : ""}${round1(rate)} kg/week`, eta, onTrack: eta ? eta <= g.due : false },
      };
    }
    // Syllabus: units per week over the last 4 weeks.
    const recentUnits = DBMS_UNIT_DAYS_AGO.filter((d) => d <= 28).length;
    const rate = recentUnits / 4;
    const eta = rate > 0 ? addDays(today, Math.ceil(((g.target - g.current) / rate) * 7)) : null;
    return {
      ...g,
      short: "DBMS syllabus",
      module: "academics" as const,
      milestones: [4, 8, 12].map((v) => ({
        label: `Unit ${v}`,
        value: v,
        reached: v <= DBMS_UNIT_DAYS_AGO.length ? addDays(today, -DBMS_UNIT_DAYS_AGO[v - 1]) : null,
      })),
      projection: { ratePerWeek: rate, rateLabel: `${round1(rate)} units/week`, eta, onTrack: eta ? eta <= g.due : false },
    };
  });

  const squat110 = fitness.lifts.squat.find((s) => s.e1rm >= 110);
  const completedGoals = squat110
    ? [{ title: "Back squat est. 1RM 110 kg", reached: squat110.date, detail: `${squat110.e1rm} kg est. from ${squat110.load} kg × ${squat110.reps}` }]
    : [];

  /* Achievements: evidence-based; unlocked dates come from the sample history */
  const problems = dsaProblems(days);
  const centuryIdx = 100 - PRIOR_DSA_SOLVED - 1;
  let runKm = 0;
  let run50: Date | null = null;
  days.forEach((d) => {
    if (!d.run) return;
    runKm += d.run.km;
    if (!run50 && runKm >= 50) run50 = d.date;
  });
  const squat15 = fitness.lifts.squat.find((s) => s.e1rm >= 1.5 * bodyweight(s.date));
  const benchBest = Math.max(...fitness.lifts.bench.map((s) => s.e1rm));
  const bench12 = fitness.lifts.bench.find((s) => s.e1rm >= 1.2 * bodyweight(s.date));
  const weeks = completeWeeks(now, 7);
  const weekFocus = weeks.map((w) => ({ end: w.end, h: inRange(days, w.start, w.end).reduce((a, d) => a + d.studyMin + d.codingMin, 0) / 60 }));
  const deep = weekFocus.find((w) => w.h >= 20);
  let run = 0,
    bestRun = 0,
    rested: Date | null = null;
  days.forEach((d) => {
    run = d.sleepH !== null && d.sleepH >= 7 ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
    if (!rested && run >= 7) rested = d.date;
  });
  let streak = 0,
    bestStreak = 0,
    fourWeeks: Date | null = null;
  weeks.forEach((w) => {
    const onPlan = inRange(days, w.start, w.end).filter((d) => d.planned > 0 && d.completed / d.planned >= 0.8).length;
    streak = onPlan >= 4 ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    if (!fourWeeks && streak >= 4) fourWeeks = addDays(w.end, -1);
  });
  const bestSgpa = Math.max(...semesters.map((s) => s.sgpa ?? 0));
  const bw = bodyweight(today);

  const achievements: Achievement[] = [
    { id: "a-century", title: "Century", criteria: "Solve 100 DSA problems", unlocked: problems[centuryIdx]?.date ?? null, current: PRIOR_DSA_SOLVED + problems.length, target: 100, unit: "problems" },
    { id: "a-run50", title: "50 km on foot", criteria: "Run 50 km in total (logged runs)", unlocked: run50, current: round1(runKm), target: 50, unit: "km" },
    { id: "a-squat15", title: "Squat 1.5× bodyweight", criteria: "Back squat est. 1RM ≥ 1.5 × latest bodyweight", unlocked: squat15?.date ?? null, current: round1(Math.max(...fitness.lifts.squat.map((s) => s.e1rm)) / bw), target: 1.5, unit: "× BW" },
    { id: "a-bench12", title: "Bench 1.2× bodyweight", criteria: "Bench press est. 1RM ≥ 1.2 × latest bodyweight", unlocked: bench12?.date ?? null, current: Math.round((benchBest / bw) * 100) / 100, target: 1.2, unit: "× BW" },
    { id: "a-deep", title: "Deep week", criteria: "20 h of focused study and coding in one Mon–Sun week", unlocked: deep ? addDays(deep.end, -1) : null, current: round1(Math.max(...weekFocus.map((w) => w.h))), target: 20, unit: "h best week" },
    { id: "a-rested", title: "Rested week", criteria: "7 nights in a row with 7 h+ logged sleep", unlocked: rested, current: bestRun, target: 7, unit: "nights best run" },
    { id: "a-plan4", title: "Four solid weeks", criteria: "4 weeks in a row with at least 4 days on plan", unlocked: fourWeeks, current: bestStreak, target: 4, unit: "weeks best run" },
    { id: "a-sgpa9", title: "Nine-pointer", criteria: "SGPA of 9.0 or higher in a semester", unlocked: null, current: bestSgpa, target: 9, unit: "best SGPA" },
  ];

  /* Adaptive challenges: fixed rules on the last 4 complete weeks */
  const last4 = completeWeeks(now, 4);
  const kmWeeks = last4.map((w) => inRange(days, w.start, w.end).reduce((a, d) => a + (d.run?.km ?? 0), 0));
  const kmBase = mean(kmWeeks) ?? 0;
  const dsaWeeks = last4.map((w) => problems.filter((p) => p.date >= w.start && p.date < w.end).length);
  const dsaBase = mean(dsaWeeks) ?? 0;
  const hardRecently = problems.some((p) => p.difficulty === "H" && p.date >= addDays(today, -14));
  const last7 = days.slice(-8, -1);
  const goodNights = last7.filter((d) => d.sleepH !== null && d.sleepH >= SLEEP_TARGET_H).length;

  const challenges: Challenge[] = [
    {
      id: "c-run",
      title: `Run ${Math.round(Math.max(kmBase * 1.1, kmBase + 1) * 2) / 2} km this week`,
      basis: `4-week average: ${round1(kmBase)} km/week`,
      rule: "+10% or +1 km on your 4-week average, whichever is larger",
      module: "fitness",
    },
    {
      id: "c-dsa",
      title: `Solve ${Math.max(Math.round(dsaBase * 1.1), Math.round(dsaBase) + 1)} DSA problems${hardRecently ? "" : ", including 1 Hard"}`,
      basis: `4-week average: ${round1(dsaBase)} problems/week${hardRecently ? "" : " · no Hard problem in 14 days"}`,
      rule: "+10% or +1 on your 4-week average; adds a Hard problem if none in 14 days",
      module: "academics",
    },
    {
      id: "c-sleep",
      title: `Sleep ${SLEEP_TARGET_H} h+ on ${Math.min(7, goodNights + 2)} nights this week`,
      basis: `Last 7 nights: ${goodNights} at ${SLEEP_TARGET_H} h or more`,
      rule: "Two more nights than last week, up to 7",
      module: "health",
    },
  ];

  const workout = plannedWorkoutToday(now, days);
  const objectives: Objective[] = [
    { id: "o1", title: "Revise DBMS normalization", detail: "90 min focused study", done: false },
    { id: "o2", title: workout.title, detail: workout.training ? "Planned workout" : "Rest-day routine", done: false },
    { id: "o3", title: "Daily check-in", detail: "Sleep, energy and recovery", done: true },
  ];

  return { objectives, quests, goals, completedGoals, achievements, challenges };
}
