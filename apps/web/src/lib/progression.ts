/**
 * Progression rules used by the Phase 0 UI to render SAMPLE data.
 *
 * These mirror the draft rules in /docs/progression-rules.md. In production
 * the backend owns every calculation (spec §4.2); this file exists only so
 * the design preview shows numbers derived by the documented method instead
 * of invented ones.
 */

/* ───────────────────────── Level curve ───────────────────────── */

/** Cumulative XP needed to REACH `level` (level 1 = 0 XP). */
export function xpForLevel(level: number, scale: number): number {
  if (level <= 1) return 0;
  return Math.round((scale * Math.pow(level - 1, 1.8)) / 10) * 10;
}

/** Overall profile curve: 100·(L−1)^1.8. Skills use a smaller scale (25). */
export const PROFILE_XP_SCALE = 100;
export const SKILL_XP_SCALE = 25;

export interface LevelProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  /** 0–1 progress within the current level */
  ratio: number;
  toNext: number;
}

export function levelFromXp(xp: number, scale: number): LevelProgress {
  let level = 1;
  while (xpForLevel(level + 1, scale) <= xp) level++;
  const currentLevelXp = xpForLevel(level, scale);
  const nextLevelXp = xpForLevel(level + 1, scale);
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    ratio: (xp - currentLevelXp) / (nextLevelXp - currentLevelXp),
    toNext: nextLevelXp - xp,
  };
}

/* ───────────────────────── Performance form ───────────────────────── */

/**
 * FORM = (mean(recent window) − mean(baseline window)) / mean(baseline window)
 *
 *  recent window   = last 14 days (days 1–14, today = day 1)
 *  baseline window = the 28 days before that (days 15–42)
 *
 * Means are over CALENDAR days in the window (inactive days count as 0 for
 * volume metrics), or over recorded values only for level metrics such as
 * estimated 1RM. A result is only shown when both windows have enough
 * recorded values; otherwise the UI shows "Not enough data".
 */
export const FORM_RECENT_DAYS = 14;
export const FORM_BASELINE_DAYS = 28;
export const FORM_MIN_RECENT = 4;
export const FORM_MIN_BASELINE = 8;
/** |form| below this is shown as "Stable" */
export const FORM_STABLE_BAND = 0.05;

export type FormResult =
  | { status: "ok"; value: number; recentMean: number; baselineMean: number; recentN: number; baselineN: number }
  | { status: "insufficient"; recentN: number; baselineN: number };

/**
 * `series` is ordered oldest → newest, one entry per calendar day, last entry
 * = today. `null` means no record that day.
 * kind "volume": nulls count as 0 in the mean, N counts non-null days.
 * kind "level":  nulls are skipped entirely.
 */
export function computeForm(series: (number | null)[], kind: "volume" | "level"): FormResult {
  const recent = series.slice(-FORM_RECENT_DAYS);
  const baseline = series.slice(-(FORM_RECENT_DAYS + FORM_BASELINE_DAYS), -FORM_RECENT_DAYS);
  const recorded = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);
  const recentN = recorded(recent).length;
  const baselineN = recorded(baseline).length;

  if (recentN < FORM_MIN_RECENT || baselineN < FORM_MIN_BASELINE || baseline.length < FORM_BASELINE_DAYS) {
    return { status: "insufficient", recentN, baselineN };
  }
  const mean = (xs: (number | null)[]) =>
    kind === "volume"
      ? xs.reduce<number>((s, x) => s + (x ?? 0), 0) / xs.length
      : recorded(xs).reduce((s, x) => s + x, 0) / recorded(xs).length;

  const recentMean = mean(recent);
  const baselineMean = mean(baseline);
  if (baselineMean === 0) return { status: "insufficient", recentN, baselineN };
  return {
    status: "ok",
    value: (recentMean - baselineMean) / baselineMean,
    recentMean,
    baselineMean,
    recentN,
    baselineN,
  };
}

export type TrendDirection = "up" | "down" | "flat";
export function trendOf(form: FormResult): TrendDirection | null {
  if (form.status !== "ok") return null;
  if (form.value > FORM_STABLE_BAND) return "up";
  if (form.value < -FORM_STABLE_BAND) return "down";
  return "flat";
}

/* ───────────────────────── Strength ───────────────────────── */

/** Epley estimated one-rep max. Only valid for 1–10 reps; else null. */
export function epley1RM(loadKg: number, reps: number): number | null {
  if (reps < 1 || reps > 10) return null;
  return reps === 1 ? loadKg : loadKg * (1 + reps / 30);
}

/* ───────────────────────── Readiness ───────────────────────── */

export const SLEEP_TARGET_H = 7.5;

export type ReadinessLevel = "High" | "Moderate" | "Low";

/**
 * Rule-based readiness from self-reported inputs only (no medical claim).
 *  sleep last night: ≥ target → 2, ≥ target−1h → 1, else 0
 *  energy (1–5):     ≥4 → 2, 3 → 1, else 0
 *  recovery (1–5):   ≥4 → 2, 3 → 1, else 0
 *  total 5–6 High · 3–4 Moderate · 0–2 Low
 * Requires all three inputs for today; otherwise null.
 */
export function computeReadiness(input: {
  sleepH: number | null;
  energy: number | null;
  recovery: number | null;
}): { level: ReadinessLevel; points: number } | null {
  const { sleepH, energy, recovery } = input;
  if (sleepH === null || energy === null || recovery === null) return null;
  const points = sleepPoints(sleepH) + scalePoints(energy) + scalePoints(recovery);
  return { level: points >= 5 ? "High" : points >= 3 ? "Moderate" : "Low", points };
}

/** Readiness points contributed by last night's sleep (0–2). */
export const sleepPoints = (h: number) => (h >= SLEEP_TARGET_H ? 2 : h >= SLEEP_TARGET_H - 1 ? 1 : 0);
/** Readiness points contributed by a 1–5 self-rating (0–2). */
export const scalePoints = (v: number) => (v >= 4 ? 2 : v === 3 ? 1 : 0);

/* ───────────────────────── Attributes ───────────────────────── */

export type AttributeKey = "intelligence" | "strength" | "endurance" | "discipline" | "vitality";

export interface AttributeSignal {
  key: string;
  label: string;
  weight: number;
  /** Normalised 0–100 against the owner's own target, or null if no data. */
  score: number | null;
}

export interface AttributeResult {
  key: AttributeKey;
  label: string;
  /** 0–100, or null when coverage is below the minimum */
  score: number | null;
  /** share (0–1) of the formula's weight that had data */
  coverage: number;
  signals: AttributeSignal[];
}

/** Below this coverage the attribute is shown as "Not enough data". */
export const ATTRIBUTE_MIN_COVERAGE = 0.6;

/**
 * Attribute score = Σ(weightᵢ · scoreᵢ) / Σ(weightᵢ) over signals that have
 * data. Missing signals are excluded and their weight re-normalised; the
 * share of weight that was available is reported as `coverage`.
 */
export function computeAttribute(key: AttributeKey, label: string, signals: AttributeSignal[]): AttributeResult {
  const present = signals.filter((s) => s.score !== null);
  const totalW = signals.reduce((a, s) => a + s.weight, 0);
  const presentW = present.reduce((a, s) => a + s.weight, 0);
  const coverage = totalW === 0 ? 0 : presentW / totalW;
  const score =
    coverage >= ATTRIBUTE_MIN_COVERAGE && presentW > 0
      ? Math.round(present.reduce((a, s) => a + s.weight * (s.score as number), 0) / presentW)
      : null;
  return { key, label, score, coverage, signals };
}

/** Normalise a measured value against a personal target to 0–100 (capped). */
export function vsTarget(value: number | null, target: number): number | null {
  if (value === null || target <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
