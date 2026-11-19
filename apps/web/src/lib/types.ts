import type { AttributeResult, FormResult, LevelProgress, ReadinessLevel } from "./progression";

export type ModuleKey = "academics" | "fitness" | "health" | "productivity" | "skills" | "goals" | "analytics";

export interface FocusTask {
  id: string;
  title: string;
  meta: string;
  module: ModuleKey;
  priority: "high" | "normal";
  done: boolean;
}

export type DayStatus = "on-plan" | "partial" | "missed" | "rest" | "today" | "future";

export interface DayCell {
  date: Date;
  status: DayStatus;
  planned: number;
  completed: number;
}

export interface SkillRow {
  key: string;
  name: string;
  progress: LevelProgress;
  form: FormResult;
  /** what the form % is measured on, e.g. "Daily focused coding minutes" */
  formMetric: string;
}

export interface XpEvent {
  id: string;
  at: Date;
  amount: number;
  skill: string;
  reason: string;
  /** set when a cap limited the award */
  capNote?: string;
}

export interface Quest {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  module: ModuleKey;
}

export interface Goal {
  id: string;
  title: string;
  start: number;
  current: number;
  target: number;
  unit: string;
  due: Date;
  nextMilestone: string;
}

export interface Insight {
  id: string;
  kind: "correlation" | "trend" | "plateau";
  title: string;
  detail: string;
  window: string;
  method: string;
}

export interface StrengthWeek {
  weekStart: Date;
  bench: number | null;
  squat: number | null;
  deadlift: number | null;
}

export interface PersonalRecord {
  lift: string;
  e1rm: number;
  load: number;
  reps: number;
  date: Date;
}

export interface DashboardData {
  now: Date;
  profile: {
    lifetimeXp: number;
    progress: LevelProgress;
    weekXp: number;
    prevWeekXpSameDays: number;
  };
  attributes: AttributeResult[];
  tasks: FocusTask[];
  readiness: {
    sleepLastNight: number | null;
    sleepAvg7: number;
    energy: number | null;
    recovery: number | null;
    result: { level: ReadinessLevel; points: number } | null;
    sleepSeries: { date: Date; hours: number | null }[];
  };
  consistency: {
    weeks: DayCell[][];
    thisWeekOnPlan: number;
    thisWeekPlannedDays: number;
    prevWeeksAvgOnPlan: number;
  };
  activity: {
    days: { date: Date; study: number; coding: number; avg7: number }[];
    studyTotal: number;
    codingTotal: number;
    prevStudyTotal: number;
    prevCodingTotal: number;
  };
  skills: SkillRow[];
  totalSkills: number;
  strength: {
    weeks: StrengthWeek[];
    latestPr: PersonalRecord | null;
  };
  quests: Quest[];
  goals: Goal[];
  xpEvents: XpEvent[];
  insights: Insight[];
}
