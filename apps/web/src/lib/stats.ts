/**
 * Small, deterministic statistics used by the preview's analytics.
 * Documented in /docs/progression-rules.md §8 (Analytics methods).
 */

export const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Minimum paired observations before a correlation is shown. */
export const CORRELATION_MIN_N = 10;

/** Pearson correlation coefficient, or null with fewer than 3 pairs or zero variance. */
export function pearson(pairs: { x: number; y: number }[]): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  const mx = sum(pairs.map((p) => p.x)) / n;
  const my = sum(pairs.map((p) => p.y)) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (const p of pairs) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Plain-language strength of |r|: < 0.3 weak, < 0.5 moderate, otherwise strong. */
export function correlationWord(r: number): "weak" | "moderate" | "strong" {
  const a = Math.abs(r);
  return a < 0.3 ? "weak" : a < 0.5 ? "moderate" : "strong";
}

/** Least-squares slope of y over x (units of y per unit of x), or null with < 2 points. */
export function slope(points: { x: number; y: number }[]): number | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = sum(points.map((p) => p.x)) / n;
  const my = sum(points.map((p) => p.y)) / n;
  let num = 0,
    den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}
