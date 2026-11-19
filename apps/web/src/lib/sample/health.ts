import { computeReadiness, type ReadinessLevel } from "../progression";
import { mulberry32, type SampleDay } from "../sample-data";
import { mean } from "../stats";

export interface HealthDay {
  date: Date;
  sleepH: number | null;
  /** self-rated 1–5 */
  sleepQuality: number | null;
  steps: number | null;
  energy: number | null;
  recovery: number | null;
  /** self-rated 1–5 */
  mood: number | null;
  readiness: { level: ReadinessLevel; points: number } | null;
}

export interface HealthData {
  days: HealthDay[]; // last 28, oldest first
  sleepAvg14: number | null;
  prevSleepAvg14: number | null;
  stepsAvg14: number | null;
  prevStepsAvg14: number | null;
  runs: { date: Date; km: number; minutes: number; pace: number }[]; // last 28 days, newest first
  /** Not logged in the sample: shown as empty so the Vitality coverage stays honest. */
  restingHr: { date: Date; bpm: number }[];
  hydration: { date: Date; litres: number }[];
}

export function buildHealth(days: SampleDay[]): HealthData {
  const rnd = mulberry32(104);
  const all: HealthDay[] = days.map((d) => {
    const q = d.sleepH === null ? null : Math.max(1, Math.min(5, Math.round((d.sleepH - 5) * 1.1 + (rnd() - 0.5) * 1.8)));
    const mood = d.energy === null ? null : Math.max(1, Math.min(5, Math.round(d.energy + (rnd() - 0.45) * 1.6)));
    return {
      date: d.date,
      sleepH: d.sleepH,
      sleepQuality: q,
      steps: d.steps,
      energy: d.energy,
      recovery: d.recovery,
      mood,
      readiness: computeReadiness({ sleepH: d.sleepH, energy: d.energy, recovery: d.recovery }),
    };
  });
  const last28 = all.slice(-28);
  const avgOf = (xs: HealthDay[], f: (d: HealthDay) => number | null) =>
    mean(xs.map(f).filter((x): x is number => x !== null));
  return {
    days: last28,
    sleepAvg14: avgOf(all.slice(-14), (d) => d.sleepH),
    prevSleepAvg14: avgOf(all.slice(-28, -14), (d) => d.sleepH),
    stepsAvg14: avgOf(all.slice(-14), (d) => d.steps),
    prevStepsAvg14: avgOf(all.slice(-28, -14), (d) => d.steps),
    runs: days
      .slice(-28)
      .filter((d) => d.run)
      .map((d) => ({ date: d.date, km: d.run!.km, minutes: d.run!.minutes, pace: d.run!.minutes / d.run!.km }))
      .reverse(),
    restingHr: [],
    hydration: [],
  };
}
