"use client";

import { Mountain, Sunrise, TrendingUp } from "lucide-react";
import { Column } from "./column";
import { Hero } from "./hero";
import { Readiness, TodayFocus, XpStream, Consistency } from "./now-modules";
import { Insights, StrengthMultiples, StudyCoding } from "./trend-modules";
import { Attributes, Goals, Skills, WeeklyQuests } from "./progression-modules";

/**
 * Overview: a hero (greeting + level path), then three columns, one per time horizon.
 *
 *  ≥1280      Now | Trends | Progression
 *  1024–1279  Now | Progression, then Trends full width (its modules in two columns)
 *  <1024      single column: Now, Progression, Trends
 */
export function Overview() {
  return (
    <div className="flex flex-col gap-8">
      <Hero />
      <div className="grid items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        <Column icon={Sunrise} title="Now" description="Today and recent XP">
          <Readiness />
          <TodayFocus />
          <XpStream />
        </Column>
        <Column
          icon={TrendingUp}
          title="Trends"
          description="14 days to 8 weeks"
          className="order-last lg:col-span-2 xl:order-none xl:col-span-1"
          bodyClassName="@4xl:grid @4xl:grid-cols-2"
        >
          <StudyCoding className="@4xl:col-span-2" />
          <StrengthMultiples className="@4xl:col-span-2" />
          <Consistency />
          <Insights className="@4xl:border-l" />
        </Column>
        <Column icon={Mountain} title="Progression" description="Capability, skills and goals">
          <Attributes />
          <Skills />
          <WeeklyQuests />
          <Goals />
        </Column>
      </div>
    </div>
  );
}
