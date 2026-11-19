import { addDays, startOfDay, startOfWeek } from "../dates";
import { mulberry32, round1, type SampleDay } from "../sample-data";
import { SUBJECTS, type FocusSession } from "./shared";

export type Difficulty = "E" | "M" | "H";

export interface SubjectRow {
  key: string;
  name: string;
  short: string;
  credits: number;
  unitsTotal: number;
  unitsDone: number;
  hours28: number;
  sessions28: number;
  lastStudied: Date | null;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  due: Date;
  status: "not-started" | "in-progress" | "submitted" | "graded";
  grade?: string;
}

export interface Semester {
  label: string;
  sgpa: number | null;
  credits: number;
}

export interface Milestone {
  id: string;
  title: string;
  kind: "learning" | "assessment" | "project";
  date: Date;
  done: boolean;
  detail?: string;
}

export interface AcademicsData {
  studyHours14: number;
  prevStudyHours14: number;
  codingHours14: number;
  prevCodingHours14: number;
  sessions: FocusSession[];
  subjects: SubjectRow[];
  assignments: Assignment[];
  dsa: {
    lifetime: number;
    window: number;
    byDifficulty: Record<Difficulty, number>;
    byTopic: { topic: string; solved: number }[];
    weekly: { weekStart: Date; count: number }[];
    nextMilestone: number;
  };
  semesters: Semester[];
  cgpa: number;
  milestones: Milestone[];
  projectMilestones: Milestone[];
}

/** DSA problems solved before the 8-week sample window (fictional). */
export const PRIOR_DSA_SOLVED = 64;
const TOPICS = ["Arrays & strings", "Trees", "Graphs", "Dynamic programming", "Greedy", "Binary search"];

export const SEMESTERS: Semester[] = [
  { label: "Sem 1", sgpa: 8.2, credits: 22 },
  { label: "Sem 2", sgpa: 8.6, credits: 22 },
  { label: "Sem 3", sgpa: 8.4, credits: 24 },
  { label: "Sem 4", sgpa: 8.9, credits: 23 },
  { label: "Sem 5", sgpa: null, credits: 24 },
];

export function cgpaOf(sems: Semester[]): number {
  const done = sems.filter((s) => s.sgpa !== null);
  const credits = done.reduce((a, s) => a + s.credits, 0);
  return Math.round((done.reduce((a, s) => a + (s.sgpa as number) * s.credits, 0) / credits) * 100) / 100;
}

/** Each solved problem with its date, topic and difficulty (topic assigned by a fixed seed). */
export function dsaProblems(days: SampleDay[]) {
  const rnd = mulberry32(103);
  return days.flatMap((d) => d.dsa.map((p) => ({ date: d.date, difficulty: p.difficulty as Difficulty, topic: TOPICS[Math.floor(rnd() * TOPICS.length)] })));
}

export function buildAcademics(now: Date, days: SampleDay[], sessions: FocusSession[]): AcademicsData {
  const today = startOfDay(now);
  const h = (xs: SampleDay[], f: (d: SampleDay) => number) => round1(xs.reduce((a, d) => a + f(d), 0) / 60);
  const last14 = days.slice(-14);
  const prev14 = days.slice(-28, -14);
  const since28 = addDays(today, -27);

  const study28 = sessions.filter((s) => s.kind === "study" && s.start >= since28);
  const subjects: SubjectRow[] = SUBJECTS.map((s) => {
    const mine = study28.filter((x) => x.label === s.short);
    const last = sessions.find((x) => x.kind === "study" && x.label === s.short);
    return {
      key: s.key,
      name: s.name,
      short: s.short,
      credits: s.credits,
      unitsTotal: s.unitsTotal,
      unitsDone: s.unitsDone,
      hours28: round1(mine.reduce((a, x) => a + x.minutes, 0) / 60),
      sessions28: mine.length,
      lastStudied: last ? last.start : null,
    };
  });

  const assignments: Assignment[] = [
    { id: "a1", title: "OS assignment 3 · Scheduling", subject: "OS", due: addDays(today, 1), status: "in-progress" },
    { id: "a2", title: "DBMS normalization worksheet", subject: "DBMS", due: addDays(today, 4), status: "not-started" },
    { id: "a3", title: "CN lab report 5", subject: "CN", due: addDays(today, 6), status: "not-started" },
    { id: "a4", title: "DM problem set 4", subject: "DM", due: addDays(today, -2), status: "submitted" },
    { id: "a5", title: "OS assignment 2 · Processes", subject: "OS", due: addDays(today, -9), status: "graded", grade: "18 / 20" },
  ];

  const problems = dsaProblems(days);
  const byDifficulty: Record<Difficulty, number> = { E: 0, M: 0, H: 0 };
  problems.forEach((p) => byDifficulty[p.difficulty]++);
  const byTopic = TOPICS.map((t) => ({ topic: t, solved: problems.filter((p) => p.topic === t).length })).sort((a, b) => b.solved - a.solved);
  const ws = startOfWeek(now);
  const weekly = Array.from({ length: 8 }, (_, k) => {
    const start = addDays(ws, -7 * (7 - k));
    const end = addDays(start, 7);
    return { weekStart: start, count: problems.filter((p) => p.date >= start && p.date < end).length };
  });
  const lifetime = PRIOR_DSA_SOLVED + problems.length;

  // Learning milestones & assessments: 4 completed in the last 90 days (matches the Intelligence attribute signal).
  const milestones: Milestone[] = [
    { id: "m1", title: "SQL joins and subqueries module", kind: "learning", date: addDays(today, -62), done: true },
    { id: "m2", title: "DBMS mid-semester exam", kind: "assessment", date: addDays(today, -38), done: true, detail: "34 / 40" },
    { id: "m3", title: "OS quiz 2", kind: "assessment", date: addDays(today, -19), done: true, detail: "9 / 10" },
    { id: "m4", title: "Graphs practice sheet finished", kind: "learning", date: addDays(today, -6), done: true },
    { id: "m5", title: "DBMS unit 8 · Transactions", kind: "learning", date: addDays(today, 3), done: false },
    { id: "m6", title: "CN mid-semester exam", kind: "assessment", date: addDays(today, 9), done: false },
  ];
  // Backend Development has no recorded milestones in the window (its form shows "—").
  const projectMilestones: Milestone[] = [
    { id: "p1", title: "API skeleton with auth endpoints", kind: "project", date: addDays(today, 12), done: false },
    { id: "p2", title: "Database schema and first migration", kind: "project", date: addDays(today, 26), done: false },
  ];

  return {
    studyHours14: h(last14, (d) => d.studyMin),
    prevStudyHours14: h(prev14, (d) => d.studyMin),
    codingHours14: h(last14, (d) => d.codingMin),
    prevCodingHours14: h(prev14, (d) => d.codingMin),
    sessions: sessions.filter((s) => s.start >= addDays(today, -13)),
    subjects,
    assignments,
    dsa: {
      lifetime,
      window: problems.length,
      byDifficulty,
      byTopic,
      weekly,
      nextMilestone: Math.ceil((lifetime + 1) / 50) * 50,
    },
    semesters: SEMESTERS,
    cgpa: cgpaOf(SEMESTERS),
    milestones,
    projectMilestones,
  };
}
