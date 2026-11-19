/**
 * SAMPLE DATA GENERATOR — Phase 0 design preview only.
 *
 * Produces a deterministic (seeded) but clearly fictional history relative to
 * the viewer's current date. Nothing here is a real measurement. Every
 * derived number (levels, form %, attributes, readiness, insights) is computed
 * from this sample history with the documented rules in ./progression.ts, so
 * the preview never shows a number that the rules could not have produced.
 */
import {
  computeAttribute,
  computeForm,
  computeReadiness,
  epley1RM,
  levelFromXp,
  PROFILE_XP_SCALE,
  SKILL_XP_SCALE,
  SLEEP_TARGET_H,
  vsTarget,
  clamp01,
} from "./progression";
import { addDays, startOfDay, startOfWeek, weekdayIndex, DAY_MS } from "./dates";
import type {
  DashboardData,
  DayCell,
  FocusTask,
  Goal,
  Insight,
  PersonalRecord,
  Quest,
  SkillRow,
  StrengthWeek,
  XpEvent,
} from "./types";

const HISTORY_DAYS = 56; // 8 weeks; form needs 42

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Lift = "bench" | "squat" | "deadlift";
export const LIFT_LABEL: Record<Lift, string> = { bench: "Bench press", squat: "Back squat", deadlift: "Deadlift" };

export interface SampleDay {
  date: Date;
  sleepH: number | null;
  energy: number | null;
  recovery: number | null;
  studyMin: number;
  codingMin: number;
  dsa: { difficulty: "E" | "M" | "H" }[];
  planned: number;
  completed: number;
  habitsPlanned: number;
  habitsDone: number;
  steps: number | null;
  run: { km: number; minutes: number } | null;
  lift: { lift: Lift; load: number; reps: number; e1rm: number } | null;
}

export const round1 = (x: number) => Math.round(x * 10) / 10;

export function generateHistory(now: Date): SampleDay[] {
  const rnd = mulberry32(20_26);
  const today = startOfDay(now);
  const days: SampleDay[] = [];
  const liftCycle: Lift[] = ["bench", "squat", "deadlift"];
  let liftIdx = 0;

  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const dow = weekdayIndex(date); // 0 Mon
    const weekend = dow >= 5;
    const isToday = i === 0;
    const weeksAgo = i / 7;

    // Sleep logged most days; recorded value = the night BEFORE this date.
    const sleepH = rnd() < 0.93 ? round1(5.6 + rnd() * 2.8) : null;
    const sleepF = sleepH === null ? 0.85 : Math.min(1.25, Math.max(0.6, (sleepH - 4.5) / 2.6));
    const energy = sleepH === null ? null : Math.max(1, Math.min(5, Math.round(1 + (sleepH - 5.5) * 1.2 + (rnd() - 0.5) * 1.6)));
    const recovery = energy === null ? null : Math.max(1, Math.min(5, Math.round(energy + (rnd() - 0.5) * 1.4)));

    // Study: tied to sleep in this sample so the correlation insight has something to find.
    const studies = !isToday && rnd() < (weekend ? 0.5 : 0.85);
    const studyMin = studies ? Math.round((35 + rnd() * 85) * sleepF) : isToday ? 0 : 0;
    // Coding: gentle upward trend over the 8 weeks.
    const codes = !isToday && rnd() < (weekend ? 0.55 : 0.75);
    const codingMin = codes ? Math.round((40 + rnd() * 90) * (1 + (8 - weeksAgo) * 0.035)) : 0;

    const dsa: SampleDay["dsa"] = [];
    if (!isToday && rnd() < 0.55) {
      const n = 1 + Math.floor(rnd() * 2.4);
      for (let k = 0; k < n; k++) {
        const r = rnd();
        dsa.push({ difficulty: r < 0.45 ? "E" : r < 0.88 ? "M" : "H" });
      }
    }

    const planned = dow === 6 ? (rnd() < 0.5 ? 0 : 1) : 3 + Math.floor(rnd() * 3);
    const completionRate = energy === null ? 0.6 : 0.45 + energy * 0.11 + (rnd() - 0.5) * 0.2;
    const completed = isToday ? 1 : Math.min(planned, Math.round(planned * clamp01(completionRate)));
    const habitsPlanned = 3;
    const habitsDone = isToday ? 1 : Math.min(3, Math.round(3 * clamp01(completionRate + 0.05)));

    const steps = rnd() < 0.9 ? Math.round(4200 + rnd() * 6800) : null;
    const run = !isToday && (dow === 1 || dow === 3 || dow === 6) && rnd() < 0.6
      ? (() => {
          const km = round1(3 + rnd() * 3.5);
          const pace = 6.4 - (8 - weeksAgo) * 0.04 + (rnd() - 0.5) * 0.4; // min/km
          return { km, minutes: Math.round(km * pace * 10) / 10 };
        })()
      : null;

    // Gym Mon/Wed/Fri/Sat, ~85% attendance; one tracked top set per session (rotation).
    let lift: SampleDay["lift"] = null;
    if (!isToday && (dow === 0 || dow === 2 || dow === 4 || dow === 5) && rnd() < 0.85) {
      const which = liftCycle[liftIdx++ % 3];
      const w = 8 - weeksAgo; // weeks of training elapsed in window
      const base =
        which === "bench" ? 64 + w * 1.1 : which === "squat" ? 84 + Math.min(w, 5) * 1.8 : 104 + w * 1.6; // squat plateaus last ~3 weeks
      const load = Math.round((base + (rnd() - 0.5) * 2) / 2.5) * 2.5;
      const reps = 4 + Math.floor(rnd() * 4);
      lift = { lift: which, load, reps, e1rm: round1(epley1RM(load, reps) ?? load) };
    }

    days.push({ date, sleepH, energy, recovery, studyMin, codingMin, dsa, planned, completed, habitsPlanned, habitsDone, steps, run, lift });
  }
  return days;
}

const SPLIT_TASK: Record<Lift, string> = { bench: "Push day — upper body", squat: "Leg day — lower body", deadlift: "Pull day — back" };
export const TRAINING_WEEKDAYS = [0, 2, 4, 5]; // Mon, Wed, Fri, Sat

/** Today's planned workout from the weekday and the Push → Legs → Pull rotation (or a rest-day routine). */
export function plannedWorkoutToday(now: Date, days: SampleDay[]): { title: string; meta: string; training: boolean } {
  const training = TRAINING_WEEKDAYS.includes(weekdayIndex(now));
  if (!training) return { title: "Mobility & stretching · 20 min", meta: "Rest day · Recovery", training };
  const next = (["bench", "squat", "deadlift"] as Lift[])[days.filter((d) => d.lift).length % 3];
  return { title: SPLIT_TASK[next], meta: `${LIFT_LABEL[next].split(" ")[0]} focus · Workout`, training };
}

/** Sample personal lift targets (owner-set in Settings later). */
export const LIFT_TARGET: Record<Lift, number> = { bench: 95, squat: 130, deadlift: 160 };

/* XP rules (illustrative; mirror /docs/progression-rules.md) */
export const STUDY_SESSION_CAP = 60;
export const CODING_SESSION_CAP = 80;
export const DSA_XP = { E: 10, M: 20, H: 35 } as const;

export function eventTime(date: Date, hour: number, minute: number) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * When each day's study and coding sessions END (hour, minute). Uses its own
 * seeded generator so it doesn't change any other sample value. Sessions start
 * at end − duration.
 */
export function sessionEndTimes(days: SampleDay[]) {
  const rt = mulberry32(77);
  return days.map((d) => {
    const weekend = weekdayIndex(d.date) >= 5;
    const r1 = rt(), r2 = rt(), r3 = rt();
    const study = weekend ? { h: 15 + Math.floor(r1 * 3), m: Math.floor(r2 * 60) } : r3 < 0.6 ? { h: 10 + Math.floor(r1 * 2), m: Math.floor(r2 * 60) } : { h: 17 + Math.floor(r1 * 3), m: Math.floor(r2 * 60) };
    const r4 = rt(), r5 = rt();
    const coding = weekend && r4 < 0.5 ? { h: 13 + Math.floor(r5 * 3), m: Math.floor(r4 * 60) } : { h: 21 + Math.floor(r5 * 2), m: Math.floor(r4 * 60) };
    return { study, coding };
  });
}

export function buildXpEvents(days: SampleDay[]): XpEvent[] {
  const events: XpEvent[] = [];
  const bestE1rm: Partial<Record<Lift, number>> = {};
  const ends = sessionEndTimes(days);
  days.forEach((d, idx) => {
    const id = (s: string) => `${idx}-${s}`;
    if (d.studyMin > 0) {
      const raw = Math.floor(d.studyMin / 3);
      const amount = Math.min(STUDY_SESSION_CAP, raw);
      events.push({
        id: id("study"),
        at: eventTime(d.date, ends[idx].study.h, ends[idx].study.m),
        amount,
        skill: "Learning",
        reason: `Focused study · ${d.studyMin} min`,
        capNote: raw > amount ? `Session cap ${STUDY_SESSION_CAP} XP applied` : undefined,
      });
    }
    if (d.codingMin > 0) {
      const raw = Math.floor(d.codingMin / 2.5);
      const amount = Math.min(CODING_SESSION_CAP, raw);
      events.push({
        id: id("code"),
        at: eventTime(d.date, ends[idx].coding.h, ends[idx].coding.m),
        amount,
        skill: "Programming",
        reason: `Coding session · ${d.codingMin} min`,
        capNote: raw > amount ? `Session cap ${CODING_SESSION_CAP} XP applied` : undefined,
      });
    }
    d.dsa.forEach((p, k) =>
      events.push({
        id: id(`dsa${k}`),
        at: eventTime(d.date, 18, 30 + k * 7),
        amount: DSA_XP[p.difficulty],
        skill: "DSA",
        reason: `${p.difficulty === "E" ? "Easy" : p.difficulty === "M" ? "Medium" : "Hard"} problem solved`,
      }),
    );
    if (d.lift) {
      events.push({ id: id("gym"), at: eventTime(d.date, 7, 40), amount: 20, skill: "Discipline", reason: "Workout session completed" });
      const prev = bestE1rm[d.lift.lift];
      if (prev !== undefined && d.lift.e1rm > prev) {
        events.push({
          id: id("pr"),
          at: eventTime(d.date, 7, 41),
          amount: 40,
          skill: "Strength",
          reason: `New est. 1RM · ${LIFT_LABEL[d.lift.lift]} ${d.lift.e1rm} kg (was ${prev} kg)`,
        });
      }
      if (prev === undefined || d.lift.e1rm > prev) bestE1rm[d.lift.lift] = d.lift.e1rm;
    }
    if (d.run) {
      events.push({
        id: id("run"),
        at: eventTime(d.date, 6, 50),
        amount: Math.min(30, 15 + Math.round(d.run.km * 3)),
        skill: "Endurance",
        reason: `Run · ${d.run.km} km`,
      });
    }
    if (d.planned > 0 && d.completed / d.planned >= 0.8 && idx < days.length - 1) {
      events.push({ id: id("plan"), at: eventTime(d.date, 23, 0), amount: 10, skill: "Consistency", reason: `Day on plan · ${d.completed}/${d.planned} items` });
    }
  });
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Fictional lifetime XP accrued BEFORE the 8-week sample window. */
export const PRIOR_SKILL_XP: Record<string, number> = {
  Programming: 2650,
  DSA: 980,
  "Backend Development": 610,
  Learning: 2210,
  Strength: 1340,
  Endurance: 520,
  Discipline: 1880,
  Consistency: 1210,
  Recovery: 430,
};

export function buildSampleDashboard(now: Date, days: SampleDay[] = generateHistory(now), events: XpEvent[] = buildXpEvents(days)): DashboardData {
  const today = days[days.length - 1];
  const weekStart = startOfWeek(now);

  /* Profile & skills */
  const skillXp: Record<string, number> = { ...PRIOR_SKILL_XP };
  events.forEach((e) => (skillXp[e.skill] = (skillXp[e.skill] ?? 0) + e.amount));
  const lifetimeXp = Object.values(skillXp).reduce((a, b) => a + b, 0);
  const weekXp = events.filter((e) => e.at >= weekStart).reduce((a, e) => a + e.amount, 0);
  const elapsedMs = now.getTime() - weekStart.getTime();
  const prevWeekXpSameDays = events
    .filter((e) => e.at >= addDays(weekStart, -7) && e.at.getTime() < weekStart.getTime() - 7 * DAY_MS + elapsedMs)
    .reduce((a, e) => a + e.amount, 0);

  // Strength level metric: e1RM relative to that lift's first value in window
  const firstE1rm: Partial<Record<Lift, number>> = {};
  const strengthIndex = days.map((d) => {
    if (!d.lift) return null;
    firstE1rm[d.lift.lift] ??= d.lift.e1rm;
    return d.lift.e1rm / (firstE1rm[d.lift.lift] as number);
  });

  const skillDefs: { key: string; name: string; series: (number | null)[]; kind: "volume" | "level"; metric: string }[] = [
    { key: "programming", name: "Programming", series: days.map((d) => (d.codingMin > 0 ? d.codingMin : null)), kind: "volume", metric: "Daily focused coding minutes" },
    { key: "dsa", name: "DSA", series: days.map((d) => (d.dsa.length ? d.dsa.reduce((a, p) => a + (p.difficulty === "E" ? 1 : p.difficulty === "M" ? 2 : 3), 0) : null)), kind: "volume", metric: "Difficulty-weighted problems solved per day (E1·M2·H3)" },
    { key: "learning", name: "Learning", series: days.map((d) => (d.studyMin > 0 ? d.studyMin : null)), kind: "volume", metric: "Daily focused study minutes" },
    { key: "strength", name: "Strength", series: strengthIndex, kind: "level", metric: "Estimated 1RM per session, relative to each lift's starting value" },
    { key: "endurance", name: "Endurance", series: days.map((d) => (d.run ? d.run.km / (d.run.minutes / 60) : null)), kind: "level", metric: "Average running speed (km/h)" },
    { key: "backend", name: "Backend Development", series: days.map(() => null), kind: "volume", metric: "Backend project milestones (no records yet)" },
  ];
  const skills: SkillRow[] = skillDefs.map((s) => ({
    key: s.key,
    name: s.name,
    progress: levelFromXp(skillXp[s.name] ?? 0, SKILL_XP_SCALE),
    form: computeForm(s.series, s.kind),
    formMetric: s.metric,
  }));

  /* Readiness */
  const last7 = days.slice(-7);
  const sleepVals = last7.map((d) => d.sleepH).filter((x): x is number => x !== null);
  const readiness = {
    sleepLastNight: today.sleepH,
    sleepAvg7: sleepVals.reduce((a, b) => a + b, 0) / Math.max(1, sleepVals.length),
    energy: today.energy,
    recovery: today.recovery,
    result: computeReadiness({ sleepH: today.sleepH, energy: today.energy, recovery: today.recovery }),
    sleepSeries: last7.map((d) => ({ date: d.date, hours: d.sleepH })),
  };

  /* Consistency: 4 weeks Mon–Sun ending with current week */
  const gridStart = addDays(weekStart, -21);
  const byTime = new Map(days.map((d) => [d.date.getTime(), d]));
  const weeks: DayCell[][] = [];
  for (let w = 0; w < 4; w++) {
    const row: DayCell[] = [];
    for (let k = 0; k < 7; k++) {
      const date = addDays(gridStart, w * 7 + k);
      const d = byTime.get(date.getTime());
      const isToday = d === today;
      if (!d) {
        row.push({ date, status: "future", planned: 0, completed: 0 });
        continue;
      }
      const ratio = d.planned ? d.completed / d.planned : 0;
      const status: DayCell["status"] = isToday
        ? "today"
        : d.planned === 0
          ? "rest"
          : ratio >= 0.8
            ? "on-plan"
            : ratio >= 0.4
              ? "partial"
              : "missed";
      row.push({ date, status, planned: d.planned, completed: d.completed });
    }
    weeks.push(row);
  }
  const cur = weeks[3];
  const thisWeekOnPlan = cur.filter((c) => c.status === "on-plan").length;
  const thisWeekPlannedDays = cur.filter((c) => c.status !== "future" && c.status !== "today" && c.status !== "rest").length;
  const prevWeeksAvgOnPlan = weeks.slice(0, 3).reduce((a, r) => a + r.filter((c) => c.status === "on-plan").length, 0) / 3;

  /* Activity: last 14 days, hours */
  const activityDays = days.slice(-14).map((d, i, arr) => {
    const idx = days.length - arr.length + i;
    const win = days.slice(Math.max(0, idx - 6), idx + 1);
    const avg7 = win.reduce((a, x) => a + x.studyMin + x.codingMin, 0) / win.length / 60;
    return { date: d.date, study: d.studyMin / 60, coding: d.codingMin / 60, avg7: round1(avg7) };
  });
  const prev14 = days.slice(-28, -14);
  const sumH = (xs: SampleDay[], f: (d: SampleDay) => number) => xs.reduce((a, d) => a + f(d), 0) / 60;

  /* Strength: weekly best e1RM per lift, last 8 weeks */
  const strengthWeeks: StrengthWeek[] = [];
  for (let w = 7; w >= 0; w--) {
    const ws = addDays(weekStart, -7 * w);
    const we = addDays(ws, 7);
    const inWeek = days.filter((d) => d.date >= ws && d.date < we && d.lift);
    const best = (l: Lift) => {
      const xs = inWeek.filter((d) => d.lift!.lift === l).map((d) => d.lift!.e1rm);
      return xs.length ? Math.max(...xs) : null;
    };
    strengthWeeks.push({ weekStart: ws, bench: best("bench"), squat: best("squat"), deadlift: best("deadlift") });
  }
  let latestPr: PersonalRecord | null = null;
  const running: Partial<Record<Lift, number>> = {};
  days.forEach((d) => {
    if (!d.lift) return;
    const prev = running[d.lift.lift];
    if (prev !== undefined && d.lift.e1rm > prev) {
      latestPr = { lift: LIFT_LABEL[d.lift.lift], e1rm: d.lift.e1rm, load: d.lift.load, reps: d.lift.reps, date: d.date };
    }
    if (prev === undefined || d.lift.e1rm > prev) running[d.lift.lift] = d.lift.e1rm;
  });

  /* Attributes (formulas: /docs/progression-rules.md §Attributes) */
  const last14 = days.slice(-14);
  const last28 = days.slice(-28);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const dsaWeighted28 = last28.reduce((a, d) => a + d.dsa.reduce((s, p) => s + (p.difficulty === "E" ? 1 : p.difficulty === "M" ? 2 : 3), 0), 0);
  const focusH14 = avg(last14.map((d) => (d.studyMin + d.codingMin) / 60));
  const latestE1rm = (l: Lift) => {
    const xs = days.filter((d) => d.lift?.lift === l);
    return xs.length ? xs[xs.length - 1].lift!.e1rm : null;
  };
  const relStrength = avg((["bench", "squat", "deadlift"] as Lift[]).map((l) => vsTarget(latestE1rm(l), LIFT_TARGET[l])).filter((x): x is number => x !== null));
  const s0 = strengthWeeks.slice(0, 2), s1 = strengthWeeks.slice(-2);
  const liftMean = (ws: StrengthWeek[]) => avg(ws.flatMap((w) => [w.bench, w.squat, w.deadlift]).filter((x): x is number => x !== null));
  const sChange = (() => {
    const a = liftMean(s0), b = liftMean(s1);
    return a && b ? (b - a) / a : null;
  })();
  const runs28 = last28.filter((d) => d.run);
  const avgSpeed = avg(runs28.map((d) => d.run!.km / (d.run!.minutes / 60)));
  const weeklyKm = runs28.reduce((a, d) => a + d.run!.km, 0) / 4;
  const steps14 = avg(last14.map((d) => d.steps).filter((x): x is number => x !== null));
  const plannedRatio = (() => {
    const p = last28.reduce((a, d) => a + d.planned, 0);
    return p ? last28.reduce((a, d) => a + d.completed, 0) / p : null;
  })();
  const habitRatio = last28.reduce((a, d) => a + d.habitsDone, 0) / last28.reduce((a, d) => a + d.habitsPlanned, 0);
  const sleep14 = avg(last14.map((d) => d.sleepH).filter((x): x is number => x !== null));
  const energyRec14 = avg(last14.filter((d) => d.energy !== null).map((d) => ((d.energy as number) + (d.recovery as number)) / 2));

  const attributes = [
    computeAttribute("intelligence", "Intelligence", [
      { key: "outcomes", label: "Learning milestones & assessments (90d) vs target 6", weight: 0.4, score: vsTarget(4, 6) },
      { key: "dsa", label: "Difficulty-weighted DSA solved (28d) vs target 40", weight: 0.35, score: vsTarget(dsaWeighted28, 40) },
      { key: "focus", label: "Focused study + coding h/day (14d) vs target 4 h", weight: 0.25, score: vsTarget(focusH14, 4) },
    ]),
    computeAttribute("strength", "Strength", [
      { key: "relative", label: "Latest est. 1RM vs personal lift targets", weight: 0.7, score: relStrength === null ? null : Math.round(relStrength) },
      { key: "progress", label: "8-week est. 1RM change (+5% = 100)", weight: 0.3, score: sChange === null ? null : Math.round(clamp01(sChange / 0.05) * 100) },
    ]),
    computeAttribute("endurance", "Endurance", [
      { key: "pace", label: "Avg running speed (28d) vs target 11 km/h", weight: 0.5, score: vsTarget(avgSpeed, 11) },
      { key: "volume", label: "Weekly running distance (28d) vs target 15 km", weight: 0.3, score: runs28.length ? vsTarget(weeklyKm, 15) : null },
      { key: "steps", label: "Daily steps (14d) vs target 8,000", weight: 0.2, score: vsTarget(steps14, 8000) },
    ]),
    computeAttribute("discipline", "Discipline", [
      { key: "planned", label: "Planned items completed (28d)", weight: 0.5, score: plannedRatio === null ? null : Math.round(plannedRatio * 100) },
      { key: "habits", label: "Habit completion (28d)", weight: 0.3, score: Math.round(habitRatio * 100) },
      { key: "focus-kept", label: "Focus sessions finished as planned (not tracked yet)", weight: 0.2, score: null },
    ]),
    computeAttribute("vitality", "Vitality", [
      { key: "sleep", label: `Sleep duration (14d) vs target ${SLEEP_TARGET_H} h`, weight: 0.4, score: vsTarget(sleep14, SLEEP_TARGET_H) },
      { key: "energy", label: "Self-rated energy & recovery (14d, of 5)", weight: 0.3, score: vsTarget(energyRec14, 5) },
      { key: "rhr", label: "Resting heart rate trend (no records)", weight: 0.15, score: null },
      { key: "hydration", label: "Hydration vs target (no records)", weight: 0.15, score: null },
    ]),
  ];

  /* Quests (weekly, reset Monday) & goals */
  const thisWeek = days.filter((d) => d.date >= weekStart);
  const quests: Quest[] = [
    { id: "q-gym", title: "Complete 4 workout sessions", current: thisWeek.filter((d) => d.lift).length, target: 4, unit: "sessions", module: "fitness" },
    { id: "q-study", title: "10 h focused study", current: round1(thisWeek.reduce((a, d) => a + d.studyMin, 0) / 60), target: 10, unit: "h", module: "academics" },
    { id: "q-dsa", title: "Solve 8 DSA problems", current: thisWeek.reduce((a, d) => a + d.dsa.length, 0), target: 8, unit: "problems", module: "academics" },
    { id: "q-sleep", title: "Log sleep every day", current: thisWeek.filter((d) => d.sleepH !== null).length, target: 7, unit: "days", module: "health" },
  ];
  const benchStart = days.find((d) => d.lift?.lift === "bench")?.lift?.e1rm ?? 0;
  const goals: Goal[] = [
    { id: "g-bench", title: "Bench press est. 1RM 95 kg", start: benchStart, current: latestE1rm("bench") ?? benchStart, target: 95, unit: "kg", due: addDays(startOfDay(now), 42), nextMilestone: "90 kg est. 1RM" },
    { id: "g-dbms", title: "Complete DBMS syllabus", start: 0, current: 7, target: 12, unit: "units", due: addDays(startOfDay(now), 18), nextMilestone: "Unit 8 · Transactions" },
  ];

  /* Insights — computed from the sample history; shown only if conditions hold */
  const insights: Insight[] = [];
  {
    const window = days.slice(-28).filter((d) => d.sleepH !== null && !(d === today));
    const good = window.filter((d) => (d.sleepH as number) >= 7);
    const poor = window.filter((d) => (d.sleepH as number) < 7);
    const gm = avg(good.map((d) => d.studyMin)), pm = avg(poor.map((d) => d.studyMin));
    if (good.length >= 5 && poor.length >= 5 && gm && pm && gm > pm * 1.15) {
      insights.push({
        id: "i-sleep-study",
        kind: "correlation",
        title: "More study time after 7 h+ sleep",
        detail: `Study averaged ${Math.round(gm)} min on days after 7 h+ sleep vs ${Math.round(pm)} min after shorter sleep.`,
        window: `Last 28 days · ${good.length} vs ${poor.length} days`,
        method: "Mean daily study minutes grouped by the previous night's logged sleep (≥7 h vs <7 h). Days without a sleep log are excluded. Correlation only — not evidence that sleep caused the difference.",
      });
    }
  }
  {
    const sq = strengthWeeks.map((w) => w.squat);
    const recentBest = Math.max(...sq.slice(-3).filter((x): x is number => x !== null), 0);
    const priorBest = Math.max(...sq.slice(0, -3).filter((x): x is number => x !== null), 0);
    if (priorBest > 0 && recentBest > 0 && recentBest <= priorBest) {
      insights.push({
        id: "i-squat-plateau",
        kind: "plateau",
        title: "Squat est. 1RM flat for 3 weeks",
        detail: `Best of the last 3 weeks is ${recentBest} kg; the earlier best was ${priorBest} kg.`,
        window: "Last 8 weeks · weekly best est. 1RM",
        method: "Plateau = the best est. 1RM in the most recent 3 weeks does not exceed the best from the 5 weeks before. Est. 1RM uses the Epley formula on top sets of 1–10 reps.",
      });
    }
  }
  {
    const prog = skills.find((s) => s.key === "programming")!.form;
    if (prog.status === "ok" && Math.abs(prog.value) >= 0.1) {
      insights.push({
        id: "i-coding-trend",
        kind: "trend",
        title: `Coding time ${prog.value > 0 ? "up" : "down"} ${Math.round(Math.abs(prog.value) * 100)}%`,
        detail: `${Math.round(prog.recentMean)} min/day over the last 14 days vs ${Math.round(prog.baselineMean)} min/day in the prior 28 days.`,
        window: "Last 14 days vs prior 28-day baseline",
        method: "Mean daily focused coding minutes (days without coding count as 0). Shown when the change is at least 10%.",
      });
    }
  }

  const workout = plannedWorkoutToday(now, days);
  const tasks: FocusTask[] = [
    { id: "t1", title: "Revise DBMS normalization", meta: "90 min · Study", module: "academics", priority: "high", done: false },
    { id: "t2", title: workout.title, meta: workout.meta, module: "fitness", priority: workout.training ? "high" : "normal", done: false },
    { id: "t3", title: "Solve 2 graph problems", meta: "DSA · Coding", module: "academics", priority: "normal", done: false },
    { id: "t4", title: "OS assignment 3", meta: "Due tomorrow · Assignment", module: "academics", priority: "normal", done: false },
    { id: "t5", title: "Log sleep, energy and recovery", meta: "Daily log · Health", module: "health", priority: "normal", done: true },
  ];

  return {
    now,
    profile: { lifetimeXp, progress: levelFromXp(lifetimeXp, PROFILE_XP_SCALE), weekXp, prevWeekXpSameDays },
    attributes,
    tasks,
    readiness,
    consistency: { weeks, thisWeekOnPlan, thisWeekPlannedDays, prevWeeksAvgOnPlan },
    activity: {
      days: activityDays,
      studyTotal: sumH(days.slice(-14), (d) => d.studyMin),
      codingTotal: sumH(days.slice(-14), (d) => d.codingMin),
      prevStudyTotal: sumH(prev14, (d) => d.studyMin),
      prevCodingTotal: sumH(prev14, (d) => d.codingMin),
    },
    skills,
    totalSkills: Object.keys(PRIOR_SKILL_XP).length,
    strength: { weeks: strengthWeeks, latestPr },
    quests,
    goals,
    // Whole days only (at least 8 entries), so per-day totals in the UI are complete.
    xpEvents: events.length <= 8 ? events : events.filter((e) => e.at >= startOfDay(events[7].at)),
    insights: insights.slice(0, 3),
  };
}
