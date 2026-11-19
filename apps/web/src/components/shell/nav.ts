import {
  ChartSpline,
  Dumbbell,
  Flag,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** shown in the top navigation */
  short: string;
  icon: LucideIcon;
  /** designed and approved in Phase 0? */
  ready: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutGrid, ready: true },
  { href: "/academics", label: "Academics", short: "Academics", icon: GraduationCap, ready: true },
  { href: "/fitness", label: "Fitness", short: "Fitness", icon: Dumbbell, ready: true },
  { href: "/health", label: "Health & Recovery", short: "Health", icon: HeartPulse, ready: true },
  { href: "/productivity", label: "Productivity", short: "Productivity", icon: ListChecks, ready: true },
  { href: "/skills", label: "Skills", short: "Skills", icon: Sparkles, ready: true },
  { href: "/goals", label: "Goals & Quests", short: "Goals", icon: Flag, ready: true },
  { href: "/analytics", label: "Analytics", short: "Analytics", icon: ChartSpline, ready: true },
];

export const SETTINGS_NAV: NavItem = { href: "/settings", label: "Settings", short: "Settings", icon: Settings, ready: false };

export const ALL_NAV = [...PRIMARY_NAV, SETTINGS_NAV];

export function activeNav(pathname: string): NavItem | undefined {
  return ALL_NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
}

export const LOG_ACTIONS = [
  "Study session",
  "Coding session",
  "Workout & sets",
  "Sleep, energy & recovery",
  "Habit or task",
] as const;
