/**
 * Date helpers. All values are computed from the viewer's clock at runtime —
 * nothing in the UI uses a hardcoded calendar date. Weeks start on Monday.
 */

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday 00:00 of the week containing `d` (ISO week, Monday first). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(x, -dow);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const fmtShort = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export const formatLongDate = (d: Date) => fmtLong.format(d);
export const formatShortDate = (d: Date) => fmtShort.format(d);
export const formatTime = (d: Date) => fmtTime.format(d);

/** "10:12", "Yesterday", "Mon", or "12 Nov" relative to `now`. */
export function formatRelativeDay(d: Date, now: Date): string {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / DAY_MS);
  if (diff === 0) return formatTime(d);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return WEEKDAY_SHORT[weekdayIndex(d)];
  return formatShortDate(d);
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
