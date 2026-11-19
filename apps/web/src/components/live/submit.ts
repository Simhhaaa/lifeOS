"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/client";

/** Human message for an API error, preferring field messages. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const f = e.problem.errors?.[0];
    if (f) return `${f.field ? `${f.field.replace(/_/g, " ")}: ` : ""}${f.message}`;
    if (e.code === "duplicate") return "That already exists.";
    if (e.code === "version_conflict") return "This changed on another device. Close and reopen to see the latest.";
    return e.problem.detail ?? e.message;
  }
  return "Something went wrong. Nothing was saved.";
}

/** A local date + time from form inputs, as an ISO instant. */
export const localIso = (date: string, time: string) => new Date(`${date}T${time || "00:00"}`).toISOString();
/** The current local time as HH:MM, for time inputs. */
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}
