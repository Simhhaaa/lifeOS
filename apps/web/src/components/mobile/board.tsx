"use client";

import type { ReactNode } from "react";
import { SampleChip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreview } from "@/lib/preview-store";
import { Phone } from "./kit";
import { CheckInScreen, FirstRunScreen, HomeScreen, LogSheet, ProfileScreen, ProgressScreen, SessionScreen, WorkoutScreen } from "./screens";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em] text-ink">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">{description}</p>
      </div>
      <div className="flex flex-wrap gap-x-10 gap-y-12">{children}</div>
    </section>
  );
}

const PRINCIPLES = [
  ["Four destinations", "Home, Log, Progress and Profile (spec §2.4). Log is the centre action on every screen."],
  ["Thumb-first", "Primary actions sit at the bottom; every control is at least 44 pt."],
  ["Prefilled logging", "Workouts start from your last session of that split. Study defaults to common lengths."],
  ["Offline first", "Every entry is saved on the phone with a unique ID and synced later, without duplicates."],
  ["Server owns XP", "Screens never show awarded XP until sync. Previews are labelled as previews."],
  ["Same language", "Same tokens, type and rules as desktop. Missing data stays visible."],
];

export function MobileBoard() {
  const { data } = usePreview();
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-wrap items-end gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-3">Phase 0 · steps 5–6 · design frames for the Expo app (built in Phase 4)</p>
          <h1 className="mt-1 font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-ink">
            Mobile<span className="text-saffron">.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink-2">
            A companion for fast logging and checking progress. These are 390 × 844 pt frames: controls inside them work,
            so you can try the flows, but nothing is saved.
          </p>
        </div>
        <SampleChip />
      </header>

      <ul className="grid gap-px overflow-hidden rounded-slab border border-edge bg-edge sm:grid-cols-2 xl:grid-cols-3">
        {PRINCIPLES.map(([t, s]) => (
          <li key={t} className="bg-slab px-5 py-4">
            <p className="text-sm font-medium text-ink">{t}</p>
            <p className="mt-0.5 text-xs text-ink-3">{s}</p>
          </li>
        ))}
      </ul>

      {!data ? (
        <div className="flex gap-10">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[880px] w-[390px] rounded-[52px]" />
          ))}
        </div>
      ) : (
        <>
          <Section
            title="Navigation & home"
            description="Home answers “what now?”: quick log, readiness, today’s plan with habits, weekly quests and recent XP. Log opens a sheet from any tab."
          >
            <Phone n={1} title="Home" caption="Tick tasks and habits in place. Quick-log chips sit above the fold." tab="home">
              <HomeScreen d={data} />
            </Phone>
            <Phone n={2} title="Log sheet" caption="One tap from any tab. The suggested workout comes from the split rotation." tab="log" overlay={<LogSheet d={data} />}>
              <HomeScreen d={data} />
            </Phone>
            <Phone n={3} title="Progress" caption="Level, attributes drawn as their formula, and skills with form." tab="progress">
              <ProgressScreen d={data} />
            </Phone>
          </Section>

          <Section
            title="Quick-log flows"
            description="Each flow fits on one screen with defaults filled in. Save is always at the bottom, in thumb reach."
          >
            <Phone n={4} title="Workout & sets" caption="Steppers for kg and reps, optional RPE, live est. 1RM against your best. Try saving a set.">
              <WorkoutScreen d={data} />
            </Phone>
            <Phone n={5} title="Study or coding session" caption="Pick subject or area, duration and focus. Coding asks for solved problems as outcome evidence.">
              <SessionScreen d={data} />
            </Phone>
            <Phone n={6} title="Daily check-in" caption="Sleep, energy and recovery, with mood and extras optional. Readiness preview updates as you tap.">
              <CheckInScreen d={data} />
            </Phone>
          </Section>

          <Section title="Sync & states" description="Where pending entries live, what the app looks like without a connection, and on day one.">
            <Phone n={7} title="Profile & sync" caption="Pending entries are visible and retryable. Settings hold targets, split and units." tab="profile">
              <ProfileScreen d={data} />
            </Phone>

            <Phone n={8} title="Offline" caption="A clear banner; entries saved on the phone carry a saffron dot until they sync." tab="home">
              <HomeScreen d={data} offline />
            </Phone>
            <Phone n={9} title="First run" caption="No fake progress. One clear first step, then what to log when it happens." tab="home">
              <FirstRunScreen d={data} />
            </Phone>
          </Section>
        </>
      )}
    </div>
  );
}
