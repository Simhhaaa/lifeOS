"use client";

import { useState } from "react";
import { Checkbox } from "radix-ui";
import { Award, Check, Flag, Lock, Medal, Sparkles, Target, Trophy } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Bar, Pips } from "@/components/ui/progress";
import { Module } from "@/components/dashboard/module";
import { PageHeader } from "@/components/page/page-header";
import { StatStrip } from "@/components/page/stat-strip";
import { DAY_MS, addDays, formatShortDate, startOfDay, startOfWeek } from "@/lib/dates";
import type { GoalDetail, Objective } from "@/lib/sample/goals";

const daysUntil = (d: Date, now: Date) => Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY_MS);

/* ───────────── Today's objectives ───────────── */

function ObjectiveList({ initial }: { initial: Objective[] }) {
  const [items, setItems] = useState(initial);
  return (
    <ul className="-mx-2 flex flex-col">
      {items.map((o) => (
        <li key={o.id}>
          <label className="group flex min-h-12 cursor-pointer items-center gap-3 rounded-box px-2 py-2 transition hover:bg-well/60">
            <Checkbox.Root
              checked={o.done}
              onCheckedChange={(c) => setItems((xs) => xs.map((x) => (x.id === o.id ? { ...x, done: c === true } : x)))}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] border-edge-strong transition group-hover:border-ink-3 data-[state=checked]:border-mint data-[state=checked]:bg-mint"
            >
              <Checkbox.Indicator>
                <Check size={12} strokeWidth={3} className="text-base" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm", o.done ? "text-ink-3 line-through" : "text-ink")}>{o.title}</span>
              <span className="block truncate text-2xs text-ink-3">{o.detail}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function Objectives() {
  return (
    <Module
      framed
      title="Today’s objectives"
      subtitle="The few things that make today count"
      className="xl:col-span-4"
      skeleton={{ rows: 3 }}
      empty={{ icon: Target, title: "No objectives today", description: "Pick up to three objectives from your plan.", action: "Set objectives" }}
    >
      {(d) => (
        <div className="flex flex-col gap-2">
          <ObjectiveList initial={d.goalsDetail.objectives} />
          <p className="text-2xs text-ink-3">Picked from today’s plan. Ticks are not saved in Phase 0.</p>
        </div>
      )}
    </Module>
  );
}

/* ───────────── Weekly quests ───────────── */

function Quests() {
  return (
    <Module
      framed
      title="Weekly quests"
      subtitle="Small weekly targets · reset every Monday"
      className="xl:col-span-4"
      skeleton={{ rows: 4 }}
      empty={{ icon: Flag, title: "No quests this week", description: "Quests are small weekly targets, such as 4 workouts or 10 focused hours." }}
    >
      {(d) => {
        const resetIn = Math.round((addDays(startOfWeek(d.now), 7).getTime() - startOfDay(d.now).getTime()) / DAY_MS);
        return (
          <div className="flex flex-col gap-3.5">
            {d.goalsDetail.quests.map((q) => {
              const done = q.current >= q.target;
              return (
                <div key={q.id}>
                  <p className="mb-1.5 flex items-baseline gap-2 text-sm">
                    <span className={cn("min-w-0 flex-1 truncate", done ? "text-mint" : "text-ink")}>
                      {done && <Check size={13} className="mr-1 inline" aria-label="Complete" />}
                      {q.title}
                    </span>
                    <span className="num shrink-0 text-xs text-ink-2">
                      {q.current}
                      <span className="text-ink-3">/{q.target}</span>
                    </span>
                  </p>
                  {Number.isInteger(q.target) && q.target <= 10 ? (
                    <Pips current={Math.floor(q.current)} target={q.target} tone={done ? "mint" : "saffron"} label={q.title} />
                  ) : (
                    <Bar value={q.current / q.target} size="sm" tone={done ? "mint" : "saffron"} label={q.title} />
                  )}
                </div>
              );
            })}
            <p className="text-2xs text-ink-3">
              Resets in {resetIn} {resetIn === 1 ? "day" : "days"} · completing a quest adds no XP of its own; the activity behind it already did
            </p>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Suggested challenges ───────────── */

function Challenges() {
  return (
    <Module
      framed
      title="Suggested challenges"
      subtitle="Adapted from your last 4 weeks · fixed rules, no AI"
      className="xl:col-span-4"
      skeleton={{ rows: 3 }}
      actions={() => (
        <MethodInfo label="challenges">
          Each challenge comes from a fixed rule applied to your last 4 complete weeks (or last 7 nights for sleep), so it
          stays within reach: about 10% above what you already do. Accepting one turns it into a quest for this week.
        </MethodInfo>
      )}
      empty={{ icon: Sparkles, title: "Not enough history", description: "Challenges need at least 4 weeks of logs." }}
    >
      {(d) => (
        <ul className="flex flex-col gap-2">
          {d.goalsDetail.challenges.map((c) => (
            <li key={c.id} className="rounded-box bg-well p-3.5">
              <p className="text-sm text-ink">{c.title}</p>
              <p className="num mt-1 text-2xs text-ink-2">{c.basis}</p>
              <p className="mt-0.5 text-2xs text-ink-3">Rule: {c.rule}</p>
              <Button size="sm" variant="secondary" className="mt-2.5" disabled title="Accepting challenges is designed after approval">
                Accept as quest
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}

/* ───────────── Goals ───────────── */

function GoalCard({ g, now }: { g: GoalDetail; now: Date }) {
  const span = g.target - g.start;
  const at = (v: number) => Math.max(0, Math.min(1, (v - g.start) / span)) * 100;
  const left = daysUntil(g.due, now);
  const p = g.projection;
  return (
    <li className="rounded-box border border-edge bg-well/40 p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">{g.title}</p>
          <p className="text-2xs text-ink-3">
            Due {formatShortDate(g.due)} · {left} days left · {g.module === "fitness" ? "Fitness" : "Academics"}
          </p>
        </div>
        {p.onTrack === null ? null : p.onTrack ? <Chip tone="mint">On pace</Chip> : <Chip tone="coral">Behind pace</Chip>}
      </div>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-[30px] leading-none font-semibold tracking-[-0.04em] text-ink">{g.current}</span>
        <span className="text-xs text-ink-3">
          / {g.target} {g.unit}
        </span>
      </p>

      {/* track with milestones */}
      <div className="relative mt-5 mb-7 h-2">
        <div className="absolute inset-0 rounded-full bg-well-strong" aria-hidden />
        <div className="absolute inset-y-0 left-0 rounded-full bg-saffron" style={{ width: `${at(g.current)}%` }} aria-hidden />
        {g.milestones.map((m) => (
          <span key={m.label} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at(m.value)}%` }}>
            <span
              className={cn(
                "block h-3.5 w-3.5 rounded-full border-2",
                m.reached ? "border-base bg-saffron" : "border-dashed border-ink-3 bg-slab",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "num absolute top-4 text-[10px] whitespace-nowrap text-ink-3",
                at(m.value) >= 95 ? "right-0" : at(m.value) <= 5 ? "left-0" : "left-1/2 -translate-x-1/2",
              )}
            >
              {m.label}
              {m.reached && ` ✓`}
            </span>
          </span>
        ))}
        <span className="sr-only">
          Milestones: {g.milestones.map((m) => `${m.label} ${m.reached ? `reached ${formatShortDate(m.reached)}` : "not yet"}`).join(", ")}
        </span>
      </div>

      <p className="text-xs text-ink-2">
        Next: <span className="text-ink">{g.nextMilestone}</span>
      </p>
      <p className="mt-1 text-2xs text-ink-3">
        Recent rate <span className="num text-ink-2">{p.rateLabel}</span>
        {p.eta ? (
          <>
            {" "}
            · at this pace, reached around <span className="num text-ink-2">{formatShortDate(p.eta)}</span>
            {p.onTrack ? " (before the due date)" : " (after the due date)"}
          </>
        ) : (
          " · no upward trend yet, so no projection"
        )}
      </p>
    </li>
  );
}

function Goals() {
  return (
    <Module
      framed
      title="Goals"
      subtitle="Measurable targets with milestones and a pace projection"
      className="xl:col-span-8"
      skeleton={{ rows: 5 }}
      actions={() => (
        <MethodInfo label="pace projection">
          The projection extends your recent rate in a straight line. Lifts use the least-squares slope of weekly best
          est. 1RM over 8 weeks; syllabus goals use units completed per week over the last 4 weeks. On pace means the
          projected date falls on or before the due date. It is an estimate, not a promise.
        </MethodInfo>
      )}
      empty={{ icon: Flag, title: "No active goals", description: "Set a measurable goal, such as a lift target or finishing a syllabus.", action: "New goal" }}
    >
      {(d) => (
        <div className="flex flex-col gap-4">
          <ul className="grid gap-3 lg:grid-cols-2">
            {d.goalsDetail.goals.map((g) => (
              <GoalCard key={g.id} g={g} now={d.now} />
            ))}
          </ul>
          {d.goalsDetail.completedGoals.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-ink-2">Completed</p>
              <ul className="flex flex-col gap-1.5">
                {d.goalsDetail.completedGoals.map((c) => (
                  <li key={c.title} className="flex items-center gap-3 rounded-box bg-well/50 px-3.5 py-2.5 text-sm">
                    <Trophy size={15} strokeWidth={1.75} className="shrink-0 text-saffron" aria-hidden />
                    <span className="min-w-0 flex-1 text-ink">{c.title}</span>
                    <span className="num hidden text-2xs text-ink-3 sm:inline">{c.detail}</span>
                    <span className="num text-2xs text-ink-2">{formatShortDate(c.reached)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Module>
  );
}

/* ───────────── Recently reached ───────────── */

function Reached() {
  return (
    <Module
      framed
      title="Recently reached"
      subtitle="Milestones, goals and achievements · last 8 weeks"
      className="xl:col-span-4"
      skeleton={{ rows: 5 }}
      empty={{ icon: Medal, title: "Nothing yet", description: "Reached milestones and unlocked achievements collect here." }}
    >
      {(d) => {
        const g = d.goalsDetail;
        const since = addDays(startOfDay(d.now), -56);
        const items = [
          ...g.goals.flatMap((x) => x.milestones.filter((m) => m.reached && m.reached >= since).map((m) => ({ date: m.reached as Date, title: `${x.short} · ${m.label}`, kind: "Milestone" }))),
          ...g.completedGoals.filter((c) => c.reached >= since).map((c) => ({ date: c.reached, title: c.title, kind: "Goal" })),
          ...g.achievements.filter((a) => a.unlocked && a.unlocked >= since).map((a) => ({ date: a.unlocked as Date, title: a.title, kind: "Achievement" })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());
        return items.length ? (
          <ol className="relative flex flex-col gap-3 border-l border-edge-strong pl-5">
            {items.map((it) => (
              <li key={it.kind + it.title} className="relative">
                <span aria-hidden className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full bg-saffron ring-4 ring-slab" />
                <p className="text-sm text-ink">{it.title}</p>
                <p className="num text-2xs text-ink-3">
                  {it.kind} · {formatShortDate(it.date)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-ink-3">Nothing reached in the last 8 weeks.</p>
        );
      }}
    </Module>
  );
}

/* ───────────── Achievements ───────────── */

function Achievements() {
  return (
    <Module
      framed
      title="Achievements"
      subtitle="Unlocked only by measured evidence · never by attendance alone"
      className="xl:col-span-12"
      skeleton={{ rows: 4 }}
      actions={() => (
        <MethodInfo label="achievements">
          Each achievement has a fixed, measurable rule checked against your logs: totals, estimated 1RM against
          bodyweight, weekly focus hours, sleep streaks, on-plan weeks or semester results. The unlock date is the first day
          the rule was met.
        </MethodInfo>
      )}
      empty={{ icon: Award, title: "No achievements yet", description: "Achievements unlock from measured progress." }}
    >
      {(d) => {
        const list = d.goalsDetail.achievements;
        const unlocked = list.filter((a) => a.unlocked).length;
        return (
          <div className="flex flex-col gap-3">
            <p className="num text-xs text-ink-2">
              {unlocked} of {list.length} unlocked
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {list.map((a) => {
                const ratio = Math.min(1, a.current / a.target);
                return (
                  <li
                    key={a.id}
                    className={cn("flex flex-col rounded-box border p-3.5", a.unlocked ? "border-saffron-line bg-saffron-soft" : "border-edge bg-well/40")}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                          a.unlocked ? "bg-saffron text-saffron-ink" : "bg-well-strong text-ink-3",
                        )}
                      >
                        {a.unlocked ? <Award size={15} strokeWidth={2} aria-hidden /> : <Lock size={13} strokeWidth={2} aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", a.unlocked ? "text-ink" : "text-ink-2")}>{a.title}</p>
                        <p className="text-2xs text-ink-3">{a.criteria}</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-3">
                      {a.unlocked ? (
                        <p className="num text-2xs text-saffron">Unlocked {formatShortDate(a.unlocked)}</p>
                      ) : (
                        <>
                          <Bar value={ratio} size="sm" tone="ink" label={`${a.title}: ${Math.round(ratio * 100)} percent`} />
                          <p className="num mt-1.5 text-2xs text-ink-3">
                            {a.current} / {a.target} {a.unit}
                          </p>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }}
    </Module>
  );
}

export function GoalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Goals & quests"
        description="Today’s objectives, weekly quests and longer goals with milestones. Achievements and challenges come from measured history, not streak-farming."
        action="New goal"
      />
      <StatStrip
        labels={["Today’s objectives", "Weekly quests complete", "Active goals", "Achievements"]}
        stats={(d) => {
          const g = d.goalsDetail;
          const onPace = g.goals.filter((x) => x.projection.onTrack).length;
          const questsDone = g.quests.filter((q) => q.current >= q.target).length;
          const unlocked = g.achievements.filter((a) => a.unlocked).length;
          const obj = g.objectives.filter((o) => o.done).length;
          return [
            { label: "Today’s objectives", value: String(obj), unit: `of ${g.objectives.length}`, note: "done so far" },
            { label: "Weekly quests complete", value: String(questsDone), unit: `of ${g.quests.length}`, note: "resets Monday" },
            { label: "Active goals", value: String(g.goals.length), note: `${onPace} on pace · ${g.goals.length - onPace} behind` },
            { label: "Achievements", value: String(unlocked), unit: `of ${g.achievements.length}`, accent: true, note: "unlocked by evidence" },
          ];
        }}
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <Objectives />
        <Quests />
        <Challenges />
        <Goals />
        <Reached />
        <Achievements />
      </div>
    </div>
  );
}
