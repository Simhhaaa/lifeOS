/**
 * Shared building blocks for module sample data (Phase 0 preview only).
 * Everything is derived from the same seeded history as the Overview, so
 * numbers agree across screens.
 */
import { addDays, startOfDay, startOfWeek } from "../dates";
import { mulberry32, sessionEndTimes, type SampleDay } from "../sample-data";

export interface FocusSession {
  id: string;
  kind: "study" | "coding";
  start: Date;
  minutes: number;
  /** subject short name for study; area for coding */
  label: string;
}

export const SUBJECTS = [
  { key: "dbms", name: "Database Management Systems", short: "DBMS", credits: 4, unitsTotal: 12, unitsDone: 7, weight: 0.35 },
  { key: "os", name: "Operating Systems", short: "OS", credits: 4, unitsTotal: 10, unitsDone: 6, weight: 0.3 },
  { key: "cn", name: "Computer Networks", short: "CN", credits: 3, unitsTotal: 10, unitsDone: 4, weight: 0.2 },
  { key: "dm", name: "Discrete Mathematics", short: "DM", credits: 3, unitsTotal: 8, unitsDone: 5, weight: 0.15 },
] as const;

/** Study and coding sessions with start times (end time from the XP award, start = end − duration). */
export function buildFocusSessions(days: SampleDay[]): FocusSession[] {
  const ends = sessionEndTimes(days);
  const rnd = mulberry32(101);
  const out: FocusSession[] = [];
  days.forEach((d, i) => {
    const pick = rnd();
    if (d.studyMin > 0) {
      let acc = 0;
      const subj = SUBJECTS.find((s) => (acc += s.weight) >= pick) ?? SUBJECTS[0];
      const end = new Date(d.date);
      end.setHours(ends[i].study.h, ends[i].study.m, 0, 0);
      out.push({ id: `s${i}`, kind: "study", start: new Date(end.getTime() - d.studyMin * 60_000), minutes: d.studyMin, label: subj.short });
    }
    const area = rnd();
    if (d.codingMin > 0) {
      const end = new Date(d.date);
      end.setHours(ends[i].coding.h, ends[i].coding.m, 0, 0);
      out.push({
        id: `c${i}`,
        kind: "coding",
        start: new Date(end.getTime() - d.codingMin * 60_000),
        minutes: d.codingMin,
        label: d.dsa.length ? "DSA practice" : area < 0.55 ? "Project work" : "Course lab",
      });
    }
  });
  return out.sort((a, b) => b.start.getTime() - a.start.getTime());
}

/**
 * Screen time, entered manually (sample). Some days are not entered.
 * Loosely, more focused work goes with less screen time, so the analytics have
 * something to find; it is still sample data.
 */
export function buildScreenTime(days: SampleDay[]): (number | null)[] {
  const rnd = mulberry32(109);
  return days.map((d, i) => {
    if (i === days.length - 1) return null; // today not entered yet
    if (rnd() < 0.12) return null;
    const focus = d.studyMin + d.codingMin;
    return Math.max(70, Math.round(265 - focus * 0.45 + (rnd() - 0.5) * 110));
  });
}

/** The last `n` complete Mon–Sun weeks before the current week, oldest first. */
export function completeWeeks(now: Date, n: number): { start: Date; end: Date }[] {
  const ws = startOfWeek(now);
  return Array.from({ length: n }, (_, k) => {
    const start = addDays(ws, -7 * (n - k));
    return { start, end: addDays(start, 7) };
  });
}

/** Days inside [start, end). */
export const inRange = (days: SampleDay[], start: Date, end: Date) => days.filter((d) => d.date >= start && d.date < end);

export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
