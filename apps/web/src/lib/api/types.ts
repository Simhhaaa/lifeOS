/**
 * API types for the operations the web app uses, mirroring docs/api/openapi.yaml.
 * Hand-written for now; replaced by types generated into packages/api-types once that tooling is set up.
 */

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  errors?: { field: string; message: string }[];
  current?: Record<string, unknown>;
}

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  timezone: string;
}

export interface Meta {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export type Priority = "high" | "normal" | "low";
export type ModuleKey = "academics" | "fitness" | "health" | "productivity" | "skills" | "goals";

export interface TaskInput {
  id?: string;
  title: string;
  notes?: string | null;
  module?: ModuleKey | null;
  priority?: Priority;
  planned_for?: string | null;
  due_at?: string | null;
}

export interface Task extends Meta {
  title: string;
  notes: string | null;
  module: ModuleKey | null;
  priority: Priority;
  planned_for: string | null;
  due_at: string | null;
  assignment_id: string | null;
  completed_at: string | null;
}

export interface DailyLogInput {
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  energy?: number | null;
  recovery?: number | null;
  mood?: number | null;
}

export interface DailyLog extends Meta, Required<DailyLogInput> {
  local_date: string;
  readiness: {
    local_date: string;
    sleep_last_night_h: number | null;
    energy: number | null;
    recovery: number | null;
    result: { level: "High" | "Moderate" | "Low"; points: number } | null;
  };
}

/* ── academics ── */

export interface Subject extends Meta {
  name: string;
  short_name: string;
  credits: number | null;
  units_total: number;
  units_done: number;
  semester_id: string | null;
  hours_28d: number;
  sessions_28d: number;
  last_studied_at: string | null;
}

export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "graded";

export interface Assignment extends Meta {
  subject_id: string;
  title: string;
  due_at: string;
  status: AssignmentStatus;
  grade_score: number | null;
  grade_max: number | null;
}

export interface Milestone extends Meta {
  kind: "learning" | "assessment" | "project";
  title: string;
  subject_id: string | null;
  project: string | null;
  planned_for: string | null;
  completed_at: string | null;
  score: number | null;
  max_score: number | null;
}

export interface Semester extends Meta {
  label: string;
  ordinal: number;
  credits: number | null;
  sgpa: number | null;
  is_current: boolean;
}

export interface FocusSession {
  id: string;
  kind: "study" | "coding";
  start: string;
  minutes: number;
  label: string;
}

export interface AcademicsSummary {
  study_hours_14d: number;
  prev_study_hours_14d: number;
  coding_hours_14d: number;
  prev_coding_hours_14d: number;
  subjects: Subject[];
  sessions_7d: FocusSession[];
  dsa: {
    lifetime: number;
    window: number;
    by_difficulty: Record<"easy" | "medium" | "hard", number>;
    by_topic: { topic: string; solved: number }[];
    weekly: { week_start: string; count: number }[];
  };
  next_deadline: Assignment | null;
}
