/**
 * The whole Phase 0 sample "world": the Overview data plus each module's
 * data, all derived from ONE seeded history so numbers agree across screens.
 * Design preview only; replaced by API data in Phase 3.
 */
import { buildSampleDashboard, buildXpEvents, generateHistory } from "./sample-data";
import type { DashboardData } from "./types";
import { buildAcademics, type AcademicsData } from "./sample/academics";
import { buildAnalytics, type AnalyticsData } from "./sample/analytics";
import { buildFitness, type FitnessData } from "./sample/fitness";
import { buildGoals, type GoalsData } from "./sample/goals";
import { buildHealth, type HealthData } from "./sample/health";
import { buildProductivity, type ProductivityData } from "./sample/productivity";
import { buildFocusSessions, buildScreenTime } from "./sample/shared";
import { buildSkills, type SkillsData } from "./sample/skills";

export interface World extends DashboardData {
  academics: AcademicsData;
  fitness: FitnessData;
  health: HealthData;
  productivity: ProductivityData;
  skillsDetail: SkillsData;
  goalsDetail: GoalsData;
  analytics: AnalyticsData;
}

export function buildSampleWorld(now: Date): World {
  const days = generateHistory(now);
  const events = buildXpEvents(days);
  const dash = buildSampleDashboard(now, days, events);
  const sessions = buildFocusSessions(days);
  const screen = buildScreenTime(days);
  const academics = buildAcademics(now, days, sessions);
  const fitness = buildFitness(now, days);
  return {
    ...dash,
    academics,
    fitness,
    health: buildHealth(days),
    productivity: buildProductivity(now, days, sessions, academics.assignments, screen, [...academics.milestones, ...academics.projectMilestones]),
    skillsDetail: buildSkills(now, events, dash.skills),
    goalsDetail: buildGoals(now, days, dash.goals, dash.quests, dash.strength.weeks, fitness, academics.semesters),
    analytics: buildAnalytics(now, days, events, sessions, fitness, dash.strength.weeks, screen),
  };
}
