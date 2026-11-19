import { addDays, startOfWeek } from "../dates";
import { levelFromXp, SKILL_XP_SCALE, type FormResult, type LevelProgress } from "../progression";
import { PRIOR_SKILL_XP } from "../sample-data";
import type { SkillRow, XpEvent } from "../types";

export interface SkillDetail {
  key: string;
  name: string;
  xp: number;
  windowXp: number;
  progress: LevelProgress;
  form: FormResult | null;
  formMetric: string | null;
  /** what earns activity XP and what counts as outcome evidence (docs/progression-rules.md §2) */
  activity: string;
  outcome: string;
  weekly: { weekStart: Date; xp: number }[];
  sources: { reason: string; xp: number; count: number }[];
  lastAward: Date | null;
}

export interface SkillsData {
  skills: SkillDetail[];
  /** every award in the 8-week sample window, newest first */
  events: XpEvent[];
}

const EVIDENCE: Record<string, { activity: string; outcome: string }> = {
  Programming: { activity: "Coding session: 1 XP per 2.5 focused min, 80 per session max", outcome: "Project milestones and shipped work (rules set in Phase 1)" },
  DSA: { activity: "None: time alone earns no DSA XP", outcome: "Problem solved: Easy 10 · Medium 20 · Hard 35 XP" },
  "Backend Development": { activity: "None yet", outcome: "Backend project milestones (none recorded in this window)" },
  Learning: { activity: "Focused study: 1 XP per 3 min, 60 per session max", outcome: "Learning milestones and assessment results" },
  Strength: { activity: "None: attending the gym earns Discipline XP, not Strength", outcome: "New est. 1RM PR for a lift: 40 XP" },
  Endurance: { activity: "Run: 15 + 3 × km XP, 30 per run max", outcome: "Pace and distance trends (form)" },
  Discipline: { activity: "Completed workout session: 20 XP, once per day", outcome: "None yet" },
  Consistency: { activity: "Day on plan (≥ 80% of planned items): 10 XP, once per day", outcome: "None yet" },
  Recovery: { activity: "No XP rule defined yet", outcome: "Recovery inputs and trends (rule open)" },
};

/** Groups award reasons like "Coding session · 135 min" into "Coding session". */
const reasonKey = (r: string) => (r.startsWith("New est. 1RM") ? "New est. 1RM PR" : r.split(" · ")[0]);

export function buildSkills(now: Date, events: XpEvent[], formRows: SkillRow[]): SkillsData {
  const ws = startOfWeek(now);
  const skills: SkillDetail[] = Object.keys(PRIOR_SKILL_XP).map((name) => {
    const mine = events.filter((e) => e.skill === name);
    const windowXp = mine.reduce((a, e) => a + e.amount, 0);
    const xp = PRIOR_SKILL_XP[name] + windowXp;
    const row = formRows.find((r) => r.name === name);
    const sources = new Map<string, { xp: number; count: number }>();
    mine.forEach((e) => {
      const k = reasonKey(e.reason);
      const s = sources.get(k) ?? { xp: 0, count: 0 };
      sources.set(k, { xp: s.xp + e.amount, count: s.count + 1 });
    });
    return {
      key: name.toLowerCase().replace(/[^a-z]+/g, "-"),
      name,
      xp,
      windowXp,
      progress: levelFromXp(xp, SKILL_XP_SCALE),
      form: row?.form ?? null,
      formMetric: row?.formMetric ?? null,
      ...EVIDENCE[name],
      weekly: Array.from({ length: 8 }, (_, k) => {
        const start = addDays(ws, -7 * (7 - k));
        const end = addDays(start, 7);
        return { weekStart: start, xp: mine.filter((e) => e.at >= start && e.at < end).reduce((a, e) => a + e.amount, 0) };
      }),
      sources: [...sources.entries()].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.xp - a.xp),
      lastAward: mine[0]?.at ?? null,
    };
  });
  return { skills: skills.sort((a, b) => b.xp - a.xp), events };
}
