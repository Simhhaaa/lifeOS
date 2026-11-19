"use client";

import { useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { ToggleGroup } from "radix-ui";
import { CalendarDays, Camera, ChevronDown, Dumbbell, LibraryBig, Pencil, Plus, RotateCw, Ruler, Trophy } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Sparkline } from "@/components/ui/sparkline";
import { AXIS, ChartTip, GRID, Legend } from "@/components/ui/chart";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Change } from "@/components/page/stat-strip";
import { LiveChip, LivePanel } from "@/components/live/live-panel";
import type { BodyMeasurement, Exercise, FitnessProgression, MuscleGroup, TrackedLift, TrainingPlan, Workout, WorkoutTemplate } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { WEEKDAY_SHORT, formatRelativeDay, formatShortDate } from "@/lib/dates";
import { todayIso } from "@/lib/local-date";
import { BodyDialog, ExerciseDialog, LIFT_LABEL, LogWorkoutDialog, MUSCLE_LABEL, PlanDialog, SplitDialog } from "./dialogs";

const MUSCLE_COLOR: Record<MuscleGroup, string> = {
  chest: "var(--sky)",
  back: "var(--lilac)",
  legs: "var(--mint)",
  shoulders: "var(--saffron)",
  arms: "var(--ref)",
  core: "var(--coral)",
  full_body: "var(--ink-3)",
};
const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];
const kg = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}`;
const day = (iso: string) => new Date(`${iso}T12:00`);

function AddButton({ label, onClick, icon = Plus }: { label: string; onClick: () => void; icon?: typeof Plus }) {
  const Icon = icon;
  return (
    <Button size="sm" variant="secondary" onClick={onClick}>
      <Icon size={13} aria-hidden /> {label}
    </Button>
  );
}

/** Best working set of a workout by est. 1RM (falls back to the heaviest set). */
function topSet(w: Workout) {
  const work = w.sets.filter((x) => !x.is_warmup);
  return [...work].sort((a, b) => (b.e1rm_kg ?? 0) - (a.e1rm_kg ?? 0) || b.load_kg - a.load_kg)[0];
}

/* ───────────── stats ───────────── */

function Stats({ p, body, plan }: { p?: FitnessProgression; body?: BodyMeasurement[]; plan: TrainingPlan | null | undefined }) {
  if (!p || !body) {
    return (
      <section aria-label="Key figures" className="grid grid-cols-2 gap-px overflow-hidden rounded-slab border border-edge bg-edge lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 bg-slab px-5 py-5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-6 w-16 rounded-ctl" />
          </div>
        ))}
      </section>
    );
  }
  const done = p.weekly.at(-1)?.sessions ?? 0;
  const planned = p.this_week.filter((d) => d.planned).length;
  const last = p.weekly.at(-2);
  const prior = p.weekly.slice(-6, -2).filter((w) => w.sessions > 0);
  const avg = prior.length ? prior.reduce((a, w) => a + w.volume_kg, 0) / prior.length : null;
  const prs = Object.values(p.lifts).reduce((a, pts) => a + (pts?.filter((x) => x.pr).length ?? 0), 0);
  const weights = body.filter((b) => b.weight_kg !== null);
  const wl = weights.at(-1);
  const cells = [
    { label: "Sessions this week", value: String(done), unit: plan ? `of ${planned} planned` : "no plan set", note: "week starts Monday" },
    {
      label: "Volume, last week",
      value: last ? (last.volume_kg / 1000).toFixed(1) : "0.0",
      unit: "t",
      note: <Change now={last?.volume_kg ?? 0} prev={avg} suffix="vs prior 4-week avg" />,
    },
    { label: "Est. 1RM PRs", value: String(prs), unit: "in 8 weeks", accent: true, note: "tracked lifts only" },
    {
      label: "Bodyweight",
      value: wl ? kg(wl.weight_kg!) : "—",
      unit: wl ? "kg" : "",
      note:
        weights.length > 1 ? (
          <Change now={wl!.weight_kg} prev={weights[0].weight_kg} suffix={`kg since ${formatShortDate(day(weights[0].measured_on))}`} mode="abs" decimals={1} />
        ) : wl ? (
          "first weigh-in in 8 weeks"
        ) : (
          "no weigh-ins in 8 weeks"
        ),
    },
  ];
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-px overflow-hidden rounded-slab border border-edge bg-edge lg:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="min-w-0 bg-slab px-5 py-4">
          <p className="truncate text-xs text-ink-3">{c.label}</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className={cn("font-display text-[30px] leading-8 font-semibold tracking-[-0.03em]", c.accent ? "text-saffron" : "text-ink")}>{c.value}</span>
            {c.unit && <span className="text-sm text-ink-3">{c.unit}</span>}
          </p>
          <p className="num mt-0.5 truncate text-2xs text-ink-3">{c.note}</p>
        </div>
      ))}
    </section>
  );
}

/* ───────────── this week ───────────── */

function ThisWeek({
  p,
  workouts,
  exercises,
  templates,
  plan,
  onPlan,
  onSplit,
}: {
  p?: FitnessProgression;
  workouts: Workout[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  plan: TrainingPlan | null | undefined;
  onPlan: () => void;
  onSplit: () => void;
}) {
  const today = todayIso();
  const exName = Object.fromEntries(exercises.map((x) => [x.id, x.name]));
  const tName = Object.fromEntries(templates.map((t) => [t.id, t.name]));
  const byId = Object.fromEntries(workouts.map((w) => [w.id, w]));
  const summary = plan
    ? `Split: ${plan.rotation.map((id) => tName[id] ?? "?").join(" → ")} on ${plan.weekdays.map((d) => WEEKDAY_SHORT[d - 1]).join(", ")}`
    : "No training plan yet";
  return (
    <LivePanel
      title="This week"
      subtitle="Training days and what was logged · Mon–Sun"
      className="xl:col-span-4"
      actions={
        <>
          <AddButton label="Split" onClick={onSplit} />
          <AddButton label="Plan" icon={CalendarDays} onClick={onPlan} />
        </>
      }
    >
      {!p ? (
        <SkeletonRows rows={7} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-2xs text-ink-3">
            {summary}
            {p.next_in_rotation && (
              <>
                {" "}
                · next: <span className="text-saffron">{p.next_in_rotation}</span>
              </>
            )}
          </p>
          <ol className="flex flex-col">
            {p.this_week.map((d, i) => {
              const w = d.workout_id ? byId[d.workout_id] : undefined;
              const status = d.workout_id ? "done" : !d.planned ? "rest" : d.date < today ? "missed" : d.date === today ? "today" : "planned";
              const top = w && topSet(w);
              return (
                <li key={d.date} className={cn("flex items-center gap-3 border-t border-edge/70 py-2.5 first:border-t-0", d.date === today && "-mx-2 rounded-box bg-well px-2")}>
                  <span className="w-9 text-xs text-ink-3">{WEEKDAY_SHORT[i]}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      status === "done" ? "bg-mint" : status === "missed" ? "ring-[1.5px] ring-coral ring-inset" : status === "rest" ? "bg-well-strong" : "ring-[1.5px] ring-saffron ring-inset",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {status === "done" ? (
                      <>
                        <span className="text-ink">{w?.split ?? "Workout"}</span>
                        {top && (
                          <span className="num ml-2 text-2xs text-ink-3">
                            {exName[top.exercise_id]} {kg(top.load_kg)} × {top.reps}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={status === "rest" ? "text-ink-3" : "text-ink-2"}>
                        {status === "rest" ? "Rest" : status === "missed" ? "Planned · not logged" : status === "today" ? "Planned today" : "Planned"}
                      </span>
                    )}
                  </span>
                  {w?.pr && <Chip tone="saffron">PR</Chip>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── sessions ───────────── */

function SessionCard({ w, exercises, open }: { w: Workout; exercises: Record<string, Exercise>; open: boolean }) {
  const minutes = w.ended_at ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60_000) : null;
  const groups: { id: string; sets: Workout["sets"] }[] = [];
  for (const x of w.sets) {
    const g = groups.find((g) => g.id === x.exercise_id);
    if (g) g.sets.push(x);
    else groups.push({ id: x.exercise_id, sets: [x] });
  }
  const top = topSet(w);
  return (
    <details open={open} className="group rounded-box border border-edge bg-well/40 open:bg-well/60">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="w-20 text-xs text-ink-3">{formatRelativeDay(new Date(w.started_at), new Date())}</span>
        <span className="font-display text-[15px] font-semibold text-ink">{w.split ?? "Workout"}</span>
        {w.pr && <Chip tone="saffron">New est. 1RM PR</Chip>}
        <span className="num ml-auto flex items-center gap-4 text-2xs text-ink-3">
          {minutes !== null && <span>{minutes} min</span>}
          <span>{w.sets.filter((x) => !x.is_warmup).length} sets</span>
          <span>{(w.volume_kg / 1000).toFixed(2)} t</span>
        </span>
        <ChevronDown size={15} className="text-ink-3 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-x-6 gap-y-3 border-t border-edge px-4 py-3 md:grid-cols-2">
        {groups.map((g) => (
          <table key={g.id} className="w-full text-xs">
            <caption className="mb-1 text-left text-xs font-medium text-ink">
              {exercises[g.id]?.name ?? "Exercise"} <span className="font-normal text-ink-3">· {exercises[g.id] ? MUSCLE_LABEL[exercises[g.id].muscle_group] : ""}</span>
            </caption>
            <thead>
              <tr className="text-[10px] text-ink-3">
                <th scope="col" className="w-8 text-left font-normal">Set</th>
                <th scope="col" className="text-right font-normal">kg</th>
                <th scope="col" className="text-right font-normal">Reps</th>
                <th scope="col" className="text-right font-normal">RPE</th>
                <th scope="col" className="text-right font-normal">Est. 1RM</th>
              </tr>
            </thead>
            <tbody className="num">
              {g.sets.map((x, i) => (
                <tr key={x.id} className={x.id === top?.id ? "text-ink" : "text-ink-2"}>
                  <td className="py-0.5 text-ink-3">{x.is_warmup ? "W" : x.id === top?.id ? "Top" : i + 1}</td>
                  <td className="py-0.5 text-right">{kg(x.load_kg)}</td>
                  <td className="py-0.5 text-right">{x.reps}</td>
                  <td className="py-0.5 text-right text-ink-3">{x.rpe ?? "—"}</td>
                  <td className="py-0.5 text-right text-ink-3">{x.e1rm_kg?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        {w.note && <p className="text-2xs text-ink-3 md:col-span-2">{w.note}</p>}
      </div>
    </details>
  );
}

function Sessions({ workouts, exercises, loading, onLog }: { workouts?: Workout[]; exercises: Exercise[]; loading: boolean; onLog: () => void }) {
  const byId = Object.fromEntries(exercises.map((x) => [x.id, x]));
  return (
    <LivePanel title="Recent sessions" subtitle="Sets, reps, load and optional RPE · volume = Σ load × reps" className="xl:col-span-8" actions={<AddButton label="Log" onClick={onLog} />}>
      {loading ? (
        <SkeletonRows rows={5} />
      ) : !workouts?.length ? (
        <EmptyState icon={Dumbbell} title="No workouts logged" description="Log a session with sets, reps and load to start your history." action={<AddButton label="Log workout" onClick={onLog} />} />
      ) : (
        <div className="flex flex-col gap-2">
          {workouts.slice(0, 5).map((w, i) => (
            <SessionCard key={w.id} w={w} exercises={byId} open={i === 0} />
          ))}
          <p className="text-2xs text-ink-3">RPE is optional and left blank when not logged · W = warm-up, not counted</p>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── progressive overload and records ───────────── */

function Overload({ p }: { p?: FitnessProgression }) {
  const available = (Object.keys(LIFT_LABEL) as TrackedLift[]).filter((l) => p?.lifts[l]?.length);
  const [picked, setPicked] = useState<TrackedLift | null>(null);
  const lift = picked && available.includes(picked) ? picked : available[0];
  const rows = (lift ? p?.lifts[lift] : undefined)?.map((x) => ({ label: formatShortDate(day(x.date)), e1rm: x.e1rm_kg, load: x.load_kg, pr: x.pr ? x.e1rm_kg : null })) ?? [];
  const first = rows[0]?.e1rm;
  const last = rows.at(-1)?.e1rm;
  return (
    <LivePanel
      title="Progressive overload"
      subtitle="Best set per session · estimated 1RM and load, kg · last 8 weeks"
      className="xl:col-span-8"
      actions={
        <MethodInfo label="estimated 1RM">
          Estimated 1RM uses Epley: load × (1 + reps ÷ 30), valid for 1–10 reps; warm-ups never count. A PR is a session whose estimate beats every earlier session of that lift by at least 0.5 kg.
          Strength only moves on measured improvement like this, never on attendance.
        </MethodInfo>
      }
    >
      {!p ? (
        <Skeleton className="h-64 rounded-box" />
      ) : !lift ? (
        <EmptyState icon={Dumbbell} title="No tracked lifts yet" description="Mark exercises as a tracked lift (bench, squat, deadlift or overhead press) and log sets of 1–10 reps." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup.Root type="single" value={lift} onValueChange={(v) => v && setPicked(v as TrackedLift)} aria-label="Lift" className="flex rounded-full bg-well p-0.5">
              {available.map((l) => (
                <ToggleGroup.Item key={l} value={l} className="h-7 rounded-full px-3 text-xs text-ink-2 transition hover:text-ink data-[state=on]:bg-ink data-[state=on]:text-base">
                  {LIFT_LABEL[l]}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
            {first !== undefined && last !== undefined && rows.length > 1 && (
              <span className="num text-xs text-ink-2">
                {first} → <span className="text-ink">{last} kg</span>{" "}
                <span className={last >= first ? "text-mint" : "text-coral"}>
                  ({last >= first ? "+" : ""}
                  {(last - first).toFixed(1)})
                </span>
              </span>
            )}
            <span className="ml-auto">
              <Legend items={[{ label: "Est. 1RM", color: "var(--sky)" }, { label: "Best-set load", color: "var(--ref)", dashed: true }, { label: "PR", color: "var(--saffron)" }]} />
            </span>
          </div>
          <div className="h-64" role="img" aria-label={`Estimated 1RM and load for ${LIFT_LABEL[lift]} over 8 weeks, with PRs marked`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={18} />
                <YAxis {...AXIS} width={40} domain={["dataMin - 6", "dataMax + 4"]} tickFormatter={(v: number) => String(Math.round(v))} />
                <Tooltip
                  cursor={{ stroke: "var(--edge-strong)" }}
                  content={(t) => <ChartTip active={t.active} label={t.label as string} rows={(t.payload ?? []).filter((x) => x.dataKey !== "pr")} format={(v) => `${v.toFixed(1)} kg`} />}
                />
                <Line dataKey="load" name="Best-set load" stroke="var(--ref)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line dataKey="e1rm" name="Est. 1RM" stroke="var(--sky)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: "var(--sky)" }} isAnimationActive={false} />
                <Scatter dataKey="pr" name="PR" fill="var(--saffron)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </LivePanel>
  );
}

function Records({ p }: { p?: FitnessProgression }) {
  const now = new Date();
  return (
    <LivePanel title="Personal records" subtitle="Best estimated 1RM per tracked lift · last 8 weeks" className="xl:col-span-4">
      {!p ? (
        <SkeletonRows rows={3} />
      ) : !p.records.length ? (
        <EmptyState icon={Trophy} title="No records yet" description="Your best estimate per tracked lift appears after logging sets of 1–10 reps." />
      ) : (
        <ul className="flex flex-col gap-2">
          {p.records.map((r) => (
            <li key={r.exercise} className="flex items-center gap-3 rounded-box bg-well p-3.5">
              <Trophy size={16} strokeWidth={1.75} className="shrink-0 text-saffron" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-2">{r.exercise}</p>
                <p className="num text-2xs text-ink-3">
                  {kg(r.load_kg)} kg × {r.reps} · {formatRelativeDay(day(r.date), now).replace(/^\d.*$/, "Today")}
                </p>
              </div>
              <p className="flex items-baseline gap-1">
                <span className="font-display text-[24px] leading-7 font-semibold tracking-[-0.03em] text-ink">{r.e1rm_kg}</span>
                <span className="text-xs text-ink-3">kg</span>
              </p>
            </li>
          ))}
          <p className="text-2xs text-ink-3">Estimates use Epley on sets of 1–10 reps.</p>
        </ul>
      )}
    </LivePanel>
  );
}

/* ───────────── volume ───────────── */

function Volume({ p, plan }: { p?: FitnessProgression; plan: TrainingPlan | null | undefined }) {
  const used = MUSCLES.filter((m) => p?.weekly.some((w) => w.sets_by_muscle[m]));
  const rows = (p?.weekly ?? []).map((w) => ({ label: formatShortDate(day(w.week_start)), sessions: w.sessions, tonnes: Math.round(w.volume_kg / 100) / 10, ...w.sets_by_muscle }));
  const past = p?.weekly.slice(0, -1) ?? [];
  const avg = past.length ? past.reduce((a, w) => a + w.sessions, 0) / past.length : 0;
  return (
    <LivePanel title="Training volume & frequency" subtitle="Working sets per muscle group per week · sessions per week · last 8 weeks" className="xl:col-span-8">
      {!p ? (
        <Skeleton className="h-60 rounded-box" />
      ) : !used.length ? (
        <EmptyState icon={Dumbbell} title="No volume yet" description="Weekly sets per muscle group appear after your first logged sessions." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="text-xs text-ink-2">
              <span className="num text-ink">{avg.toFixed(1)}</span> sessions/week on average{plan ? ` (${plan.weekdays.length} planned)` : ""}
            </p>
            <span className="ml-auto">
              <Legend items={used.map((m) => ({ label: MUSCLE_LABEL[m], color: MUSCLE_COLOR[m] }))} />
            </span>
          </div>
          <div className="h-60" role="img" aria-label="Stacked bars of weekly working sets by muscle group over 8 weeks">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barCategoryGap="28%">
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} width={40} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--well)", opacity: 0.6 }}
                  content={(t) => {
                    const row = t.payload?.[0]?.payload as { sessions: number; tonnes: number } | undefined;
                    return <ChartTip active={t.active} label={`Week of ${t.label} · ${row?.sessions ?? 0} sessions · ${row?.tonnes ?? 0} t`} rows={t.payload} format={(v) => `${v} sets`} />;
                  }}
                />
                {used.map((m, i) => (
                  <RBar key={m} dataKey={m} name={MUSCLE_LABEL[m]} stackId="s" fill={MUSCLE_COLOR[m]} radius={i === used.length - 1 ? [5, 5, 0, 0] : undefined} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-8 gap-1.5 text-center" aria-label="Sessions per week">
            {rows.map((r) => (
              <div key={r.label} className="rounded-ctl bg-well py-1.5">
                <p className="num text-sm text-ink">{r.sessions}</p>
                <p className="text-[10px] text-ink-3">sessions</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── body ───────────── */

function Body({ body, onLog }: { body?: BodyMeasurement[]; onLog: () => void }) {
  const w = (body ?? []).filter((b) => b.weight_kg !== null);
  const waist = (body ?? []).filter((b) => b.waist_cm !== null);
  const wl = w.at(-1);
  const wa = waist.at(-1);
  return (
    <LivePanel title="Body" subtitle="Measurements, kg and cm · last 8 weeks" className="xl:col-span-4" actions={<AddButton label="Log" onClick={onLog} />}>
      {!body ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="flex flex-col gap-4">
          {!body.length ? (
            <EmptyState icon={Ruler} title="No measurements" description="Log bodyweight or waist to track body changes." action={<AddButton label="Log measurement" onClick={onLog} />} />
          ) : (
            <>
              <div className="rounded-box bg-well p-3.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-ink-2">Bodyweight</p>
                  <p className="num text-2xs text-ink-3">{w.length} weigh-in{w.length === 1 ? "" : "s"}</p>
                </div>
                {wl ? (
                  <>
                    <p className="mt-0.5 flex items-baseline gap-1">
                      <span className="font-display text-[24px] leading-7 font-semibold tracking-[-0.03em] text-ink">{kg(wl.weight_kg!)}</span>
                      <span className="text-xs text-ink-3">kg</span>
                      {w.length > 1 && (
                        <span className="num ml-2 text-2xs text-ink-3">
                          <Change now={wl.weight_kg} prev={w[0].weight_kg} suffix={`kg since ${formatShortDate(day(w[0].measured_on))}`} mode="abs" decimals={1} />
                        </span>
                      )}
                    </p>
                    <div className="mt-2">
                      <Sparkline values={w.map((x) => x.weight_kg)} color="var(--sky)" height={44} label="Bodyweight over 8 weeks" />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-2xs text-ink-3">No weigh-ins yet</p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-box bg-well p-3.5">
                <div>
                  <p className="text-xs text-ink-2">Waist</p>
                  <p className="num text-2xs text-ink-3">{wa ? formatShortDate(day(wa.measured_on)) : "not measured"}</p>
                </div>
                {wa && (
                  <p className="flex items-baseline gap-1">
                    <span className="font-display text-[22px] font-semibold text-ink">{wa.waist_cm}</span>
                    <span className="text-xs text-ink-3">cm</span>
                  </p>
                )}
              </div>
            </>
          )}
          <EmptyState icon={Camera} title="No progress photos" description="Photos are stored privately and never shared. Uploading needs private storage, which comes with hosting." />
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── library ───────────── */

function Library({ exercises, loading, onAdd, onEdit }: { exercises?: Exercise[]; loading: boolean; onAdd: () => void; onEdit: (x: Exercise) => void }) {
  const now = new Date();
  return (
    <LivePanel title="Exercise library" subtitle="Your exercises · sessions and best estimated 1RM, last 8 weeks" className="xl:col-span-12" actions={<AddButton label="Exercise" onClick={onAdd} />}>
      {loading ? (
        <SkeletonRows rows={6} />
      ) : !exercises?.length ? (
        <EmptyState icon={LibraryBig} title="Library is empty" description="Add the exercises you train; mark bench, squat, deadlift or overhead press as tracked lifts." action={<AddButton label="Add exercise" onClick={onAdd} />} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <caption className="sr-only">Exercise library</caption>
            <thead>
              <tr className="text-2xs text-ink-3">
                <th scope="col" className="pb-2 font-normal">Exercise</th>
                <th scope="col" className="pb-2 font-normal">Muscle group</th>
                <th scope="col" className="pb-2 font-normal">Equipment</th>
                <th scope="col" className="pb-2 text-right font-normal">Sessions</th>
                <th scope="col" className="pb-2 text-right font-normal">Best est. 1RM</th>
                <th scope="col" className="pb-2 text-right font-normal">Last done</th>
                <th scope="col" className="w-10 pb-2"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((x) => (
                <tr key={x.id} className="border-t border-edge/70">
                  <td className="py-2 text-ink">
                    {x.name}
                    {x.tracked_lift && <span className="ml-2 text-2xs text-saffron">tracked</span>}
                  </td>
                  <td className="py-2">
                    <span className="flex items-center gap-1.5 text-xs text-ink-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: MUSCLE_COLOR[x.muscle_group] }} aria-hidden />
                      {MUSCLE_LABEL[x.muscle_group]}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-ink-3">{x.equipment ?? "—"}</td>
                  <td className="num py-2 text-right text-ink-2">{x.sessions_8w}</td>
                  <td className="num py-2 text-right text-ink">{x.best_e1rm_kg !== null ? `${x.best_e1rm_kg} kg` : <span className="text-2xs text-ink-3">—</span>}</td>
                  <td className="num py-2 text-right text-2xs text-ink-3">{x.last_done ? formatRelativeDay(day(x.last_done), now).replace(/^\d.*$/, "Today") : "—"}</td>
                  <td className="py-2 text-right">
                    <button type="button" aria-label={`Edit ${x.name}`} onClick={() => onEdit(x)} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── page ───────────── */

type DialogKind = null | "workout" | "exercise" | "split" | "plan" | "body";

export function FitnessLive() {
  const prog = useResource<FitnessProgression>("/fitness/progression");
  const workouts = useResource<{ items: Workout[]; next_cursor: string | null }>("/workouts", { limit: 20 });
  const exercises = useResource<Exercise[]>("/exercises");
  const templates = useResource<WorkoutTemplate[]>("/workout-templates");
  const plan = useResource<TrainingPlan | null>("/training-plan");
  const body = useResource<BodyMeasurement[]>("/body-measurements", { weeks: 8 });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [editing, setEditing] = useState<Exercise | undefined>();
  const all = [prog, workouts, exercises, templates, plan, body];

  const reloadAll = () => all.forEach((r) => void r.reload());
  const failed = all.find((r) => r.status === "error" && r.data === undefined);
  const close = (o: boolean) => {
    if (!o) {
      setDialog(null);
      setEditing(undefined);
    }
  };
  const ex = exercises.data ?? [];
  const ts = templates.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">
          <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-ink">
            Fitness<span className="text-saffron">.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink-2">
            Sessions, sets and progressive overload. Strength only counts measured improvement in load, reps or estimated 1RM, never attendance alone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveChip />
          <button type="button" onClick={reloadAll} aria-label="Refresh" className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
            <RotateCw size={15} aria-hidden />
          </button>
          <Button variant="primary" onClick={() => setDialog("workout")}>
            <Plus size={15} strokeWidth={2.5} aria-hidden /> Log workout
          </Button>
        </div>
      </header>

      {failed ? (
        <ErrorState what="fitness" onRetry={reloadAll} />
      ) : (
        <>
          <Stats p={prog.data} body={body.data} plan={plan.data} />
          <div className="grid gap-5 xl:grid-cols-12">
            <ThisWeek p={prog.data} workouts={workouts.data?.items ?? []} exercises={ex} templates={ts} plan={plan.data} onPlan={() => setDialog("plan")} onSplit={() => setDialog("split")} />
            <Sessions workouts={workouts.data?.items} exercises={ex} loading={workouts.status === "loading"} onLog={() => setDialog("workout")} />
            <Overload p={prog.data} />
            <Records p={prog.data} />
            <Volume p={prog.data} plan={plan.data} />
            <Body body={body.data} onLog={() => setDialog("body")} />
            <Library
              exercises={exercises.data}
              loading={exercises.status === "loading"}
              onAdd={() => setDialog("exercise")}
              onEdit={(x) => {
                setEditing(x);
                setDialog("exercise");
              }}
            />
          </div>
        </>
      )}

      {/* Keys reset each dialog's form when what it edits changes. */}
      <LogWorkoutDialog key={`w-${prog.data?.next_in_rotation}-${ts.length}`} open={dialog === "workout"} onOpenChange={close} onSaved={reloadAll} exercises={ex} templates={ts} suggested={prog.data?.next_in_rotation ?? null} />
      <ExerciseDialog key={`e-${editing?.id ?? "new"}-${editing?.version}`} open={dialog === "exercise"} onOpenChange={close} onSaved={reloadAll} existing={editing} />
      <SplitDialog open={dialog === "split"} onOpenChange={close} onSaved={reloadAll} exercises={ex} />
      <PlanDialog key={`p-${plan.data?.version ?? 0}`} open={dialog === "plan"} onOpenChange={close} onSaved={reloadAll} templates={ts} plan={plan.data ?? null} />
      <BodyDialog open={dialog === "body"} onOpenChange={close} onSaved={reloadAll} />
    </div>
  );
}
