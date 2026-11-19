import { addDays, startOfDay, startOfWeek } from "../dates";
import { epley1RM } from "../progression";
import { LIFT_LABEL, TRAINING_WEEKDAYS, mulberry32, round1, type Lift, type SampleDay } from "../sample-data";

export type Muscle = "Chest" | "Back" | "Legs" | "Shoulders" | "Arms";
export type SplitDay = "Push" | "Pull" | "Legs";

export interface ExerciseSet {
  load: number;
  reps: number;
  /** optional, 6–10 */
  rpe: number | null;
  top?: boolean;
}
export interface ExerciseEntry {
  exercise: string;
  muscle: Muscle;
  sets: ExerciseSet[];
}
export interface WorkoutSession {
  id: string;
  date: Date;
  split: SplitDay;
  minutes: number;
  exercises: ExerciseEntry[];
  volume: number;
  setCount: number;
  top: { exercise: string; load: number; reps: number; e1rm: number };
  pr: boolean;
}
export interface LibraryRow {
  exercise: string;
  muscle: Muscle;
  equipment: string;
  sessions: number;
  best: number | null;
  last: Date | null;
}
export interface FitnessData {
  sessions: WorkoutSession[];
  /** training days of the current week, Mon–Sun */
  thisWeek: { date: Date; planned: boolean; session: WorkoutSession | null }[];
  weekly: { weekStart: Date; sessions: number; volume: number; sets: Record<Muscle, number> }[];
  lifts: Record<Lift, { date: Date; e1rm: number; load: number; reps: number; pr: boolean }[]>;
  prs: { exercise: string; e1rm: number; load: number; reps: number; date: Date }[];
  library: LibraryRow[];
  weighIns: { date: Date; kg: number }[];
  waist: { date: Date; cm: number }[];
}

export const MUSCLES: Muscle[] = ["Chest", "Back", "Legs", "Shoulders", "Arms"];
export const TRAINING_DAYS = TRAINING_WEEKDAYS;

const SPLIT_OF: Record<Lift, SplitDay> = { bench: "Push", squat: "Legs", deadlift: "Pull" };
const PLAN: Record<SplitDay, { exercise: string; muscle: Muscle; equipment: string; base?: number; reps?: number; step?: number }[]> = {
  Push: [
    { exercise: "Bench press", muscle: "Chest", equipment: "Barbell" },
    { exercise: "Overhead press", muscle: "Shoulders", equipment: "Barbell", base: 37.5, reps: 8, step: 2.5 },
    { exercise: "Incline dumbbell press", muscle: "Chest", equipment: "Dumbbells", base: 22, reps: 10, step: 2 },
    { exercise: "Triceps pushdown", muscle: "Arms", equipment: "Cable", base: 25, reps: 12, step: 2.5 },
  ],
  Pull: [
    { exercise: "Deadlift", muscle: "Back", equipment: "Barbell" },
    { exercise: "Barbell row", muscle: "Back", equipment: "Barbell", base: 57.5, reps: 8, step: 2.5 },
    { exercise: "Lat pulldown", muscle: "Back", equipment: "Cable", base: 52.5, reps: 10, step: 2.5 },
    { exercise: "Dumbbell curl", muscle: "Arms", equipment: "Dumbbells", base: 12, reps: 12, step: 2 },
  ],
  Legs: [
    { exercise: "Back squat", muscle: "Legs", equipment: "Barbell" },
    { exercise: "Romanian deadlift", muscle: "Legs", equipment: "Barbell", base: 70, reps: 8, step: 2.5 },
    { exercise: "Leg press", muscle: "Legs", equipment: "Machine", base: 140, reps: 10, step: 5 },
    { exercise: "Standing calf raise", muscle: "Legs", equipment: "Machine", base: 60, reps: 15, step: 5 },
  ],
};

const roundTo = (x: number, step: number) => Math.round(x / step) * step;

export function buildFitness(now: Date, days: SampleDay[]): FitnessData {
  const rnd = mulberry32(102);
  const today = startOfDay(now);
  const best: Partial<Record<Lift, number>> = {};
  const sessions: WorkoutSession[] = [];

  days.forEach((d, i) => {
    if (!d.lift) return;
    const w = i / 7; // weeks into the window
    const split = SPLIT_OF[d.lift.lift];
    const exercises: ExerciseEntry[] = PLAN[split].map((p, k) => {
      if (k === 0) {
        const backoff = roundTo(d.lift!.load * 0.85, 2.5);
        return {
          exercise: p.exercise,
          muscle: p.muscle,
          sets: [
            { load: d.lift!.load, reps: d.lift!.reps, rpe: Math.round((8 + rnd() * 1.5) * 2) / 2, top: true },
            { load: backoff, reps: d.lift!.reps + 2, rpe: rnd() < 0.6 ? 7.5 : null },
            { load: backoff, reps: d.lift!.reps + 2, rpe: rnd() < 0.6 ? 8 : null },
          ],
        };
      }
      const load = roundTo((p.base as number) * (1 + w * 0.012) + (rnd() - 0.5) * (p.step as number), p.step as number);
      return {
        exercise: p.exercise,
        muscle: p.muscle,
        sets: Array.from({ length: 3 }, (_, s) => ({
          load,
          reps: (p.reps as number) - (s === 2 && rnd() < 0.4 ? 1 : 0),
          rpe: rnd() < 0.45 ? Math.round((7 + rnd() * 1.5) * 2) / 2 : null,
        })),
      };
    });
    const volume = exercises.reduce((a, e) => a + e.sets.reduce((s, x) => s + x.load * x.reps, 0), 0);
    const prev = best[d.lift.lift];
    const pr = prev !== undefined && d.lift.e1rm > prev;
    if (prev === undefined || d.lift.e1rm > prev) best[d.lift.lift] = d.lift.e1rm;
    sessions.push({
      id: `w${i}`,
      date: d.date,
      split,
      minutes: 52 + Math.round(rnd() * 22),
      exercises,
      volume: Math.round(volume),
      setCount: exercises.reduce((a, e) => a + e.sets.length, 0),
      top: { exercise: LIFT_LABEL[d.lift.lift], load: d.lift.load, reps: d.lift.reps, e1rm: d.lift.e1rm },
      pr,
    });
  });

  const ws = startOfWeek(now);
  const thisWeek = Array.from({ length: 7 }, (_, k) => {
    const date = addDays(ws, k);
    return {
      date,
      planned: TRAINING_DAYS.includes(k),
      session: sessions.find((s) => s.date.getTime() === date.getTime()) ?? null,
    };
  });

  const weekly = Array.from({ length: 8 }, (_, k) => {
    const start = addDays(ws, -7 * (7 - k));
    const end = addDays(start, 7);
    const inWeek = sessions.filter((s) => s.date >= start && s.date < end);
    const sets = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
    inWeek.forEach((s) => s.exercises.forEach((e) => (sets[e.muscle] += e.sets.length)));
    return { weekStart: start, sessions: inWeek.length, volume: inWeek.reduce((a, s) => a + s.volume, 0), sets };
  });

  const lifts = { bench: [], squat: [], deadlift: [] } as FitnessData["lifts"];
  const running: Partial<Record<Lift, number>> = {};
  days.forEach((d) => {
    if (!d.lift) return;
    const prev = running[d.lift.lift];
    const pr = prev !== undefined && d.lift.e1rm > prev;
    if (prev === undefined || d.lift.e1rm > prev) running[d.lift.lift] = d.lift.e1rm;
    lifts[d.lift.lift].push({ date: d.date, e1rm: d.lift.e1rm, load: d.lift.load, reps: d.lift.reps, pr });
  });

  // Best estimated 1RM per exercise (Epley is only valid for 1–10 reps).
  const allExercises = (Object.values(PLAN) as (typeof PLAN)[SplitDay][]).flat();
  const library: LibraryRow[] = allExercises.map((p) => {
    const used = sessions.filter((s) => s.exercises.some((e) => e.exercise === p.exercise));
    let bestE: number | null = null;
    used.forEach((s) =>
      s.exercises
        .filter((e) => e.exercise === p.exercise)
        .forEach((e) =>
          e.sets.forEach((x) => {
            const v = epley1RM(x.load, x.reps);
            if (v !== null && (bestE === null || v > bestE)) bestE = round1(v);
          }),
        ),
    );
    return { exercise: p.exercise, muscle: p.muscle, equipment: p.equipment, sessions: used.length, best: bestE, last: used.length ? used[used.length - 1].date : null };
  });

  const prs = (["bench", "squat", "deadlift"] as Lift[])
    .map((l) => {
      const xs = lifts[l];
      if (!xs.length) return null;
      const top = xs.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
      return { exercise: LIFT_LABEL[l], e1rm: top.e1rm, load: top.load, reps: top.reps, date: top.date };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Body measurements: weekly weigh-ins (Mondays) and fortnightly waist, sample values.
  const weighIns = Array.from({ length: 8 }, (_, k) => {
    const date = addDays(ws, -7 * (7 - k));
    return { date, kg: round1(72.2 + k * 0.12 + (rnd() - 0.5) * 0.5) };
  }).filter((x) => x.date <= today);
  const waist = [0, 2, 4, 6].map((k) => ({ date: addDays(ws, -7 * (7 - k)), cm: round1(81.5 - k * 0.15 + (rnd() - 0.5) * 0.4) }));

  return { sessions: sessions.reverse(), thisWeek, weekly, lifts, prs, library, weighIns, waist };
}
