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
