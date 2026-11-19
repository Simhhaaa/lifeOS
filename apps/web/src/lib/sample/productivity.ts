import { addDays, startOfDay, startOfWeek } from "../dates";
import { mulberry32, plannedWorkoutToday, type SampleDay } from "../sample-data";
import type { ModuleKey } from "../types";
import type { Assignment } from "./academics";
import { TRAINING_DAYS } from "./fitness";
import type { FocusSession } from "./shared";

export interface PlannedTask {
  id: string;
  title: string;
  meta: string;
  module: ModuleKey;
  priority: "high" | "normal" | "low";
  day: "today" | "tomorrow" | "later";
  due: Date;
  done: boolean;
}

export interface CalendarItem {
  title: string;
  kind: "deadline" | "workout" | "exam" | "milestone" | "task";
  done?: boolean;
}

export interface Habit {
  id: string;
  name: string;
  /** last 28 days, oldest first; null = today, not yet scored */
  days: (boolean | null)[];
  streak: number;
  rate28: number;
}

export interface ProductivityData {
  tasks: PlannedTask[];
  completion7: { planned: number; completed: number };
  completionPrev7: { planned: number; completed: number };
  week: { date: Date; items: CalendarItem[]; adherence: { planned: number; completed: number } | null }[];
  focusSessions: FocusSession[]; // current week
  focusPrevWeekMinutes: number; // previous week, same weekdays elapsed
  habits: Habit[];
  screen: { date: Date; minutes: number | null; focusMinutes: number }[]; // last 14 days
}

const HABITS = ["Morning stretch · 10 min", "Read 20 pages", "No phone in the first hour"];

export function buildProductivity(
  now: Date,
  days: SampleDay[],
  sessions: FocusSession[],
  assignments: Assignment[],
  screenMinutes: (number | null)[],
  milestones: { title: string; date: Date; done: boolean; kind: string }[],
): ProductivityData {
  const today = startOfDay(now);
  const ws = startOfWeek(now);
  const rnd = mulberry32(106);

  const workout = plannedWorkoutToday(now, days);
  const tasks: PlannedTask[] = [
    { id: "t1", title: "Revise DBMS normalization", meta: "90 min · Study", module: "academics", priority: "high", day: "today", due: today, done: false },
    { id: "t2", title: workout.title, meta: workout.meta, module: "fitness", priority: workout.training ? "high" : "normal", day: "today", due: today, done: false },
    { id: "t3", title: "Solve 2 graph problems", meta: "DSA · Coding", module: "academics", priority: "normal", day: "today", due: today, done: false },
    { id: "t4", title: "OS assignment 3", meta: "Due tomorrow · Assignment", module: "academics", priority: "normal", day: "today", due: addDays(today, 1), done: false },
    { id: "t5", title: "Log sleep, energy and recovery", meta: "Daily log · Health", module: "health", priority: "normal", day: "today", due: today, done: true },
    { id: "t6", title: "Submit OS assignment 3", meta: "Assignment · OS", module: "academics", priority: "high", day: "tomorrow", due: addDays(today, 1), done: false },
    { id: "t7", title: "Easy run · 5 km", meta: "Endurance", module: "fitness", priority: "normal", day: "tomorrow", due: addDays(today, 1), done: false },
    { id: "t8", title: "Start DBMS normalization worksheet", meta: "Assignment · DBMS", module: "academics", priority: "normal", day: "later", due: addDays(today, 3), done: false },
    { id: "t9", title: "Plan next week", meta: "Sunday review", module: "productivity", priority: "low", day: "later", due: addDays(ws, 6), done: false },
  ];

  const ratio = (xs: SampleDay[]) => ({ planned: xs.reduce((a, d) => a + d.planned, 0), completed: xs.reduce((a, d) => a + d.completed, 0) });
  const closed = days.slice(0, -1); // today is not scored until it ends

  const week = Array.from({ length: 7 }, (_, k) => {
    const date = addDays(ws, k);
    const items: CalendarItem[] = [];
    assignments.filter((a) => a.due.getTime() === date.getTime()).forEach((a) => items.push({ title: a.title.split(" · ")[0], kind: "deadline", done: a.status === "submitted" || a.status === "graded" }));
    const d = days.find((x) => x.date.getTime() === date.getTime());
    if (TRAINING_DAYS.includes(k)) {
      items.push({ title: "Workout", kind: "workout", done: date < today ? Boolean(d?.lift) : undefined });
    }
    milestones
      .filter((m) => startOfDay(m.date).getTime() === date.getTime())
      .forEach((m) => items.push({ title: m.title.split(" · ")[0], kind: m.kind === "assessment" ? "exam" : "milestone", done: m.done }));
    tasks
      .filter((t) => t.due.getTime() === date.getTime() && t.module !== "fitness" && !t.meta.startsWith("Assignment") && !t.meta.includes("Due"))
      .forEach((t) => items.push({ title: t.title, kind: "task", done: t.done }));
    const adherence = d && date < today && d.planned > 0 ? { planned: d.planned, completed: d.completed } : null;
    return { date, items, adherence };
  });

  const focusSessions = sessions.filter((s) => s.start >= ws);
  const elapsed = now.getTime() - ws.getTime();
  const prevStart = addDays(ws, -7);
  const focusPrevWeekMinutes = sessions
    .filter((s) => s.start >= prevStart && s.start.getTime() < prevStart.getTime() + elapsed)
    .reduce((a, s) => a + s.minutes, 0);

  // Which habits were done each day: the daily count comes from the shared history.
  const last28 = days.slice(-28);
  const flags = last28.map((d, i) => {
    // Today is in progress: done habits show, the rest are not scored yet.
    if (i === last28.length - 1) return [d.habitsDone >= 1 ? true : null, null, null] as (boolean | null)[];
    const order = [0, 1, 2];
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    const done = new Set(order.slice(0, d.habitsDone));
    return [0, 1, 2].map((h) => done.has(h));
  });
  const habits: Habit[] = HABITS.map((name, h) => {
    const ds = flags.map((f) => f[h]);
    let streak = 0;
    for (let i = ds.length - 1; i >= 0; i--) {
      if (ds[i] === null) continue;
      if (ds[i]) streak++;
      else break;
    }
    const scored = ds.filter((x): x is boolean => x !== null);
    return { id: `h${h}`, name, days: ds, streak, rate28: scored.filter(Boolean).length / scored.length };
  });

  const screen = days.slice(-14).map((d, i) => ({
    date: d.date,
    minutes: screenMinutes[screenMinutes.length - 14 + i],
    focusMinutes: d.studyMin + d.codingMin,
  }));

  return {
    tasks,
    completion7: ratio(closed.slice(-7)),
    completionPrev7: ratio(closed.slice(-14, -7)),
    week,
    focusSessions,
    focusPrevWeekMinutes,
    habits,
    screen,
  };
}
