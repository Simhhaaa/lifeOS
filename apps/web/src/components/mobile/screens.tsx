"use client";

import { useState } from "react";
import { Checkbox } from "radix-ui";
import {
  BookOpen,
  Check,
  ChevronRight,
  CloudOff,
  Code2,
  Dumbbell,
  Footprints,
  ListChecks,
  Moon,
  RefreshCw,
  Repeat,
  Target,
  WifiOff,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { FormBadge } from "@/components/ui/form-badge";
import { Bar, Pips, Ring } from "@/components/ui/progress";
import { WEEKDAY_SHORT, formatLongDate, formatRelativeDay, greeting, isoWeek, weekdayIndex } from "@/lib/dates";
import { computeReadiness, epley1RM, SLEEP_TARGET_H } from "@/lib/progression";
import type { SplitDay, WorkoutSession } from "@/lib/sample/fitness";
import type { World } from "@/lib/world";
import { FlowHeader, MCard, MLabel, PrimaryBar, ScreenHeader, Scale5, Stepper } from "./kit";

const fmtH = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
const kg = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/* ───────────────────────── Home ───────────────────────── */

function LevelButton({ d }: { d: World }) {
  const p = d.profile.progress;
  return (
    <span className="relative grid h-14 w-14 place-items-center" aria-label={`Level ${p.level}`}>
      <span className="absolute inset-0">
        <Ring value={p.ratio} size={56} stroke={4} />
      </span>
      <span className="font-display text-lg font-semibold text-ink">{p.level}</span>
    </span>
  );
}

function TodayList({ d, pendingIds = [] }: { d: World; pendingIds?: string[] }) {
  const [tasks, setTasks] = useState(d.tasks);
  const [habits, setHabits] = useState(d.productivity.habits.map((h) => ({ name: h.name.split(" · ")[0], done: h.days[h.days.length - 1] === true })));
  return (
    <>
      <ul className="-mx-1 flex flex-col">
        {tasks.map((t) => (
          <li key={t.id}>
            <label className="flex min-h-[52px] items-center gap-3 rounded-[14px] px-1 active:bg-well">
              <Checkbox.Root
                checked={t.done}
                onCheckedChange={(c) => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: c === true } : x)))}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] border-edge-strong data-[state=checked]:border-mint data-[state=checked]:bg-mint"
              >
                <Checkbox.Indicator>
                  <Check size={14} strokeWidth={3} className="text-base" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[15px]", t.done ? "text-ink-3 line-through" : "text-ink")}>{t.title}</span>
                <span className="block truncate text-[12px] text-ink-3">{t.meta}</span>
              </span>
              {pendingIds.includes(t.id) && <span className="h-2 w-2 rounded-full bg-saffron" title="Saved on this phone, waiting to sync" />}
              {t.priority === "high" && !t.done && <Chip tone="saffron">High</Chip>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-edge pt-3">
        <p className="mb-2 text-[12px] text-ink-3">Habits · tap to mark done</p>
        <div className="flex flex-wrap gap-2">
          {habits.map((h, i) => (
            <button
              key={h.name}
              type="button"
              aria-pressed={h.done}
              onClick={() => setHabits((hs) => hs.map((x, k) => (k === i ? { ...x, done: !x.done } : x)))}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition",
                h.done ? "bg-mint-soft text-mint" : "bg-well text-ink-2",
              )}
            >
              {h.done ? <Check size={14} strokeWidth={3} aria-hidden /> : <Repeat size={13} aria-hidden />}
              {h.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

const QUICK = [
  { label: "Workout", icon: Dumbbell },
  { label: "Study", icon: BookOpen },
  { label: "Coding", icon: Code2 },
  { label: "Check-in", icon: Moon },
  { label: "Steps", icon: Footprints },
];

export function HomeScreen({ d, offline = false }: { d: World; offline?: boolean }) {
  const r = d.readiness;
  const g = greeting(d.now);
  return (
    <div className="flex flex-col gap-3 pb-6">
      <ScreenHeader
        sub={`${formatLongDate(d.now)} · Week ${isoWeek(d.now)}`}
        title={g}
        right={<LevelButton d={d} />}
      />
      {offline && (
        <div className="mx-4 flex items-start gap-3 rounded-[16px] border border-saffron-line bg-saffron-soft p-3.5" role="status">
          <WifiOff size={18} className="mt-0.5 shrink-0 text-saffron" aria-hidden />
          <p className="text-[13px] text-ink">
            You’re offline. <span className="text-ink-2">2 entries are saved on this phone and will sync automatically.</span>
          </p>
        </div>
      )}

      {/* quick log */}
      <div className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {QUICK.map((q) => (
          <button key={q.label} type="button" className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-well px-4 text-[14px] text-ink active:bg-well-strong">
            <q.icon size={16} className="text-saffron" aria-hidden />
            {q.label}
          </button>
        ))}
      </div>

      <MCard>
        <MLabel right="today’s check-in">Readiness</MLabel>
        <div className="flex items-center gap-4">
          <p
            className={cn(
              "font-display text-[28px] leading-none font-semibold tracking-[-0.03em]",
              r.result?.level === "High" ? "text-mint" : r.result?.level === "Low" ? "text-coral" : "text-ink",
            )}
          >
            {r.result?.level ?? "Incomplete"}
          </p>
          <dl className="num ml-auto grid grid-cols-3 gap-3 text-right text-[12px]">
            <div>
              <dt className="text-ink-3">Sleep</dt>
              <dd className="text-ink">{r.sleepLastNight === null ? "—" : fmtH(r.sleepLastNight)}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Energy</dt>
              <dd className="text-ink">{r.energy ?? "—"}/5</dd>
            </div>
            <div>
              <dt className="text-ink-3">Recov.</dt>
              <dd className="text-ink">{r.recovery ?? "—"}/5</dd>
            </div>
          </dl>
        </div>
      </MCard>

      <MCard>
        <MLabel right={`${d.tasks.filter((t) => t.done).length}/${d.tasks.length} done`}>Today</MLabel>
        <TodayList d={d} pendingIds={offline ? ["t5"] : []} />
      </MCard>

      <MCard>
        <MLabel right={`+${d.profile.weekXp} XP this week`}>Weekly quests</MLabel>
        <ul className="flex flex-col gap-3">
          {d.quests.slice(0, 3).map((q) => (
            <li key={q.id}>
              <p className="mb-1.5 flex justify-between text-[14px]">
                <span className="text-ink">{q.title}</span>
                <span className="num text-ink-3">
                  {q.current}/{q.target}
                </span>
              </p>
              {Number.isInteger(q.target) && q.target <= 10 ? (
                <Pips current={Math.floor(q.current)} target={q.target} label={q.title} />
              ) : (
                <Bar value={q.current / q.target} size="sm" label={q.title} />
              )}
            </li>
          ))}
        </ul>
      </MCard>

      <MCard>
        <MLabel right="from the server">Recent XP</MLabel>
        <ul className="flex flex-col">
          {d.xpEvents.slice(0, 4).map((e) => (
            <li key={e.id} className="flex items-center gap-3 border-t border-edge/70 py-2.5 first:border-t-0 first:pt-0">
              <span className="num w-10 text-[15px] text-saffron">+{e.amount}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-ink">{e.reason}</span>
                <span className="block text-[12px] text-ink-3">
                  {e.skill} · {formatRelativeDay(e.at, d.now)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </MCard>
      <p className="px-6 text-center text-[11px] text-ink-3">Sample data · design preview</p>
    </div>
  );
}

/** First run: nothing logged yet. */
export function FirstRunScreen({ d }: { d: World }) {
  return (
    <div className="flex flex-col gap-3 pb-6">
      <ScreenHeader sub={`${formatLongDate(d.now)} · Week ${isoWeek(d.now)}`} title="Welcome" />
      <MCard className="border-saffron-line">
        <p className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink">Start with today’s check-in</p>
        <p className="mt-1.5 text-[14px] text-ink-2">
          Sleep, energy and recovery take about 20 seconds and unlock readiness. Everything else can wait.
        </p>
        <button type="button" className="mt-4 h-12 w-full rounded-full bg-saffron text-[15px] font-semibold text-saffron-ink">
          Daily check-in
        </button>
      </MCard>
      <MCard>
        <MLabel>Then, when it happens</MLabel>
        <ul className="flex flex-col">
          {[
            { icon: Dumbbell, t: "Log a workout", s: "Sets, reps and load. Strength counts measured progress only." },
            { icon: BookOpen, t: "Log a study or coding session", s: "Time plus outcomes like solved problems." },
            { icon: ListChecks, t: "Plan tomorrow", s: "3–5 items, so consistency has something to measure." },
          ].map((x) => (
            <li key={x.t} className="flex items-center gap-3 border-t border-edge/70 py-3 first:border-t-0 first:pt-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-well text-ink-2">
                <x.icon size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink">{x.t}</span>
                <span className="block text-[12px] text-ink-3">{x.s}</span>
              </span>
              <ChevronRight size={18} className="text-ink-3" aria-hidden />
            </li>
          ))}
        </ul>
      </MCard>
      <MCard>
        <MLabel>Level</MLabel>
        <p className="flex items-baseline gap-2">
          <span className="font-display text-[34px] leading-none font-semibold text-ink-3">Lv 1</span>
          <span className="num text-[13px] text-ink-3">0 XP</span>
        </p>
        <p className="mt-2 text-[13px] text-ink-3">The server awards XP for validated activity. Your first entry starts the level path.</p>
      </MCard>
    </div>
  );
}

/* ───────────────────────── Log sheet ───────────────────────── */

const LOG_OPTIONS = [
  { icon: Dumbbell, t: "Workout & sets", s: "Start or continue a session" },
  { icon: BookOpen, t: "Study session", s: "Timer or manual" },
  { icon: Code2, t: "Coding session", s: "Timer or manual" },
  { icon: Moon, t: "Daily check-in", s: "Sleep, energy, mood" },
  { icon: Footprints, t: "Steps & run", s: "Count, distance, time" },
  { icon: Target, t: "Habit or task", s: "Mark done" },
];

export function LogSheet({ d }: { d: World }) {
  const next = nextWorkout(d);
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div role="dialog" aria-label="Log" className="relative rounded-t-[28px] border-t border-edge-strong bg-slab px-4 pt-2.5 pb-9">
        <span aria-hidden className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-edge-strong" />
        <p className="mb-3 px-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">Log</p>
        <button type="button" className="mb-3 flex w-full items-center gap-3 rounded-[16px] border border-saffron-line bg-saffron-soft p-3.5 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron text-saffron-ink">
            <Dumbbell size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] text-ink">{next.split} day</span>
            <span className="block text-[12px] text-ink-2">Next in rotation · prefilled from your last {next.split.toLowerCase()} session</span>
          </span>
          <ChevronRight size={18} className="text-saffron" aria-hidden />
        </button>
        <div className="grid grid-cols-2 gap-2">
          {LOG_OPTIONS.map((o) => (
            <button key={o.t} type="button" className="flex min-h-[84px] flex-col items-start gap-2 rounded-[16px] bg-well p-3.5 text-left active:bg-well-strong">
              <o.icon size={20} className="text-saffron" aria-hidden />
              <span>
                <span className="block text-[14px] text-ink">{o.t}</span>
                <span className="block text-[12px] text-ink-3">{o.s}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-3">
          <CloudOff size={12} aria-hidden /> Works offline · entries sync when you’re back online
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── Workout flow ───────────────────────── */

const ROTATION: SplitDay[] = ["Push", "Legs", "Pull"];

function nextWorkout(d: World): { split: SplitDay; last: WorkoutSession | undefined } {
  const latest = d.fitness.sessions[0];
  const split = latest ? ROTATION[(ROTATION.indexOf(latest.split) + 1) % 3] : "Push";
  return { split, last: d.fitness.sessions.find((s) => s.split === split) };
}

export function WorkoutScreen({ d }: { d: World }) {
  const { split, last } = nextWorkout(d);
  const main = last?.exercises[0];
  const top = main?.sets.find((s) => s.top) ?? main?.sets[0];
  const [load, setLoad] = useState(top?.load ?? 60);
  const [reps, setReps] = useState(top?.reps ?? 5);
  const [rpe, setRpe] = useState<number | null>(null);
  const [done, setDone] = useState<{ load: number; reps: number; rpe: number | null }[]>(top ? [{ load: top.load, reps: top.reps, rpe: 8 }] : []);
  const est = epley1RM(load, reps);
  const best = d.fitness.prs.find((p) => p.exercise === main?.exercise)?.e1rm;
  return (
    <div className="flex min-h-full flex-col">
      <FlowHeader title={`${split} day`} sub="Workout in progress · saved as you go" action="Close" />
      <div className="flex flex-1 flex-col gap-3">
        <MCard>
          <div className="flex items-baseline justify-between">
            <p className="font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">{main?.exercise ?? "Exercise"}</p>
            <span className="text-[12px] text-ink-3">1 of {last?.exercises.length ?? 4}</span>
          </div>
          {top && (
            <p className="num mt-0.5 text-[12px] text-ink-3">
              Last time: {kg(top.load)} kg × {top.reps} · {last ? formatRelativeDay(last.date, d.now) : ""}
            </p>
          )}
          <table className="num mt-3 w-full text-[14px]">
            <thead>
              <tr className="text-[11px] text-ink-3">
                <th className="text-left font-normal">Set</th>
                <th className="text-right font-normal">kg</th>
                <th className="text-right font-normal">Reps</th>
                <th className="text-right font-normal">RPE</th>
              </tr>
            </thead>
            <tbody>
              {done.map((s, i) => (
                <tr key={i} className="text-ink-2">
                  <td className="py-1">
                    <Check size={14} className="inline text-mint" aria-label="done" /> {i + 1}
                  </td>
                  <td className="py-1 text-right">{kg(s.load)}</td>
                  <td className="py-1 text-right">{s.reps}</td>
                  <td className="py-1 text-right text-ink-3">{s.rpe ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </MCard>

        <MCard className="border-saffron-line">
          <MLabel right={`Set ${done.length + 1}`}>Next set</MLabel>
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-[12px] text-ink-3">Load</p>
              <Stepper label="load" value={load} onChange={setLoad} step={2.5} min={0} max={400} format={(v) => `${kg(v)} kg`} />
            </div>
            <div>
              <p className="mb-1 text-[12px] text-ink-3">Reps</p>
              <Stepper label="reps" value={reps} onChange={setReps} step={1} min={1} max={30} format={(v) => String(v)} />
            </div>
            <div>
              <p className="mb-1 flex justify-between text-[12px] text-ink-3">
                RPE <span>optional</span>
              </p>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="RPE">
                {[6, 7, 8, 9, 10].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={rpe === v}
                    onClick={() => setRpe(rpe === v ? null : v)}
                    className={cn("num h-11 rounded-[12px] text-[15px]", rpe === v ? "bg-ink text-base" : "bg-well text-ink-2")}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <p className="num rounded-[12px] bg-well px-3 py-2 text-[12px] text-ink-2">
              Est. 1RM {est ? `${est.toFixed(1)} kg` : "— (over 10 reps)"}
              {est && best ? (
                est > best ? (
                  <span className="text-saffron"> · above your best {best} kg</span>
                ) : (
                  <span className="text-ink-3"> · best {best} kg</span>
                )
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => {
                setDone((xs) => [...xs, { load, reps, rpe }]);
                setRpe(null);
              }}
              className="h-12 w-full rounded-full bg-well-strong text-[15px] font-medium text-ink active:bg-edge-strong"
            >
              Save set
            </button>
          </div>
        </MCard>

        <MCard>
          <MLabel>Up next</MLabel>
          <ul className="flex flex-col">
            {last?.exercises.slice(1).map((e) => (
              <li key={e.exercise} className="flex items-center justify-between border-t border-edge/70 py-2.5 text-[14px] first:border-t-0 first:pt-0">
                <span className="text-ink">{e.exercise}</span>
                <span className="num text-[12px] text-ink-3">
                  {e.sets.length} × {e.sets[0].reps} · {kg(e.sets[0].load)} kg
                </span>
              </li>
            ))}
          </ul>
        </MCard>
      </div>
      <PrimaryBar note="Strength XP only for a measured est. 1RM PR. The server confirms after sync.">Finish workout</PrimaryBar>
    </div>
  );
}

/* ───────────────────────── Study / coding flow ───────────────────────── */

export function SessionScreen({ d }: { d: World }) {
  const [kind, setKind] = useState<"study" | "coding">("study");
  const [subject, setSubject] = useState(d.academics.subjects[0]?.short ?? "DBMS");
  const [minutes, setMinutes] = useState(60);
  const [focus, setFocus] = useState<number | null>(4);
  const [problems, setProblems] = useState(0);
  return (
    <div className="flex min-h-full flex-col">
      <FlowHeader title="Log session" sub="Manual entry · or start a timer" />
      <div className="flex flex-1 flex-col gap-3">
        <div className="mx-4 grid grid-cols-2 rounded-full bg-well p-1" role="radiogroup" aria-label="Session type">
          {(["study", "coding"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn("h-10 rounded-full text-[14px] capitalize", kind === k ? "bg-ink text-base" : "text-ink-2")}
            >
              {k}
            </button>
          ))}
        </div>
        <MCard>
          <MLabel>{kind === "study" ? "Subject" : "Area"}</MLabel>
          <div className="flex flex-wrap gap-2">
            {(kind === "study" ? d.academics.subjects.map((s) => s.short) : ["DSA practice", "Project work", "Course lab"]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={subject === s}
                onClick={() => setSubject(s)}
                className={cn("h-10 rounded-full px-4 text-[14px]", subject === s ? "bg-saffron text-saffron-ink" : "bg-well text-ink-2")}
              >
                {s}
              </button>
            ))}
          </div>
        </MCard>
        <MCard>
          <MLabel right="focused time only">Duration</MLabel>
          <Stepper label="duration" value={minutes} onChange={setMinutes} step={5} min={5} max={300} format={(v) => `${v} min`} />
          <div className="mt-3 flex gap-2">
            {[25, 45, 60, 90].map((m) => (
              <button key={m} type="button" onClick={() => setMinutes(m)} className="num h-9 flex-1 rounded-full bg-well text-[13px] text-ink-2">
                {m}
              </button>
            ))}
          </div>
        </MCard>
        <MCard>
          <MLabel>How focused was it?</MLabel>
          <Scale5 label="Focus" value={focus} onChange={setFocus} low="Distracted" high="Deep focus" />
        </MCard>
        {kind === "coding" && (
          <MCard>
            <MLabel right="outcome evidence">DSA problems solved</MLabel>
            <Stepper label="problems" value={problems} onChange={setProblems} step={1} min={0} max={20} format={(v) => String(v)} />
          </MCard>
        )}
        {kind === "study" && (
          <MCard>
            <MLabel right="optional">Outcome</MLabel>
            <button type="button" className="flex h-11 w-full items-center justify-between rounded-[12px] bg-well px-3.5 text-[14px] text-ink-2">
              Unit finished or test score
              <ChevronRight size={16} aria-hidden />
            </button>
          </MCard>
        )}
      </div>
      <PrimaryBar note="XP is calculated by the server after sync, with session caps.">Save session</PrimaryBar>
    </div>
  );
}

/* ───────────────────────── Daily check-in ───────────────────────── */

export function CheckInScreen({ d }: { d: World }) {
  const [sleep, setSleep] = useState(d.readiness.sleepLastNight ?? 7);
  const [quality, setQuality] = useState<number | null>(3);
  const [energy, setEnergy] = useState<number | null>(d.readiness.energy);
  const [recovery, setRecovery] = useState<number | null>(d.readiness.recovery);
  const [mood, setMood] = useState<number | null>(null);
  const preview = computeReadiness({ sleepH: sleep, energy, recovery });
  return (
    <div className="flex min-h-full flex-col">
      <FlowHeader title="Daily check-in" sub={`${WEEKDAY_SHORT[weekdayIndex(d.now)]} · about 20 seconds`} />
      <div className="flex flex-1 flex-col gap-3">
        <MCard>
          <MLabel right={`target ${SLEEP_TARGET_H} h`}>Sleep last night</MLabel>
          <Stepper label="sleep" value={sleep} onChange={setSleep} step={0.25} min={0} max={14} format={fmtH} />
          <div className="mt-3">
            <Scale5 label="Sleep quality" value={quality} onChange={setQuality} low="Poor" high="Great" />
          </div>
        </MCard>
        <MCard>
          <MLabel>Energy</MLabel>
          <Scale5 label="Energy" value={energy} onChange={setEnergy} low="Drained" high="Full" />
          <p className="mt-3 mb-2.5 text-[13px] font-medium text-ink-2">Recovery</p>
          <Scale5 label="Recovery" value={recovery} onChange={setRecovery} low="Sore" high="Fresh" />
          <p className="mt-3 mb-2.5 flex justify-between text-[13px] font-medium text-ink-2">
            Mood <span className="text-xs font-normal text-ink-3">optional</span>
          </p>
          <Scale5 label="Mood" value={mood} onChange={setMood} low="Low" high="Great" />
        </MCard>
        <MCard>
          <MLabel right="optional">More</MLabel>
          {["Steps", "Water", "Resting heart rate"].map((x) => (
            <button key={x} type="button" className="mb-2 flex h-11 w-full items-center justify-between rounded-[12px] bg-well px-3.5 text-[14px] text-ink-2 last:mb-0">
              {x}
              <span className="text-[12px] text-ink-3">Add</span>
            </button>
          ))}
        </MCard>
        <div className="mx-4 flex items-center gap-3 rounded-[16px] bg-well p-3.5" role="status">
          <span className="text-[13px] text-ink-2">Readiness preview</span>
          <span
            className={cn(
              "ml-auto font-display text-[20px] font-semibold",
              preview?.level === "High" ? "text-mint" : preview?.level === "Low" ? "text-coral" : "text-ink",
            )}
          >
            {preview ? `${preview.level} · ${preview.points}/6` : "Add all three"}
          </span>
        </div>
      </div>
      <PrimaryBar note="A planning aid, not medical advice.">Save check-in</PrimaryBar>
    </div>
  );
}

/* ───────────────────────── Progress ───────────────────────── */

export function ProgressScreen({ d }: { d: World }) {
  const p = d.profile.progress;
  return (
    <div className="flex flex-col gap-3 pb-6">
      <ScreenHeader sub="Lifetime level, capability and skills" title="Progress" />
      <MCard>
        <div className="flex items-end gap-3">
          <span className="font-display text-[52px] leading-[0.85] font-semibold tracking-[-0.05em] text-ink">{p.level}</span>
          <span className="num pb-1 text-[13px] text-ink-2">
            {d.profile.lifetimeXp.toLocaleString()} XP
            <br />
            <span className="text-ink-3">{p.toNext.toLocaleString()} to Lv {p.level + 1}</span>
          </span>
          <span className="ml-auto pb-1 text-right text-[13px]">
            <span className="num block text-saffron">+{d.profile.weekXp}</span>
            <span className="text-ink-3">this week</span>
          </span>
        </div>
        <Bar value={p.ratio} size="lg" className="mt-4" label="Progress to next level" />
      </MCard>
      <MCard>
        <MLabel right="0–100 · can go down">Attributes</MLabel>
        <ul className="flex flex-col gap-3">
          {d.attributes.map((a) => (
            <li key={a.key}>
              <p className="mb-1.5 flex items-baseline justify-between text-[14px]">
                <span className="text-ink">{a.label}</span>
                <span className="font-display text-[18px] font-semibold text-ink">{a.score ?? "—"}</span>
              </p>
              <div className="flex h-2 gap-[3px]" aria-hidden>
                {a.signals.map((s) => (
                  <span
                    key={s.key}
                    className={cn("relative overflow-hidden rounded-full", s.score === null ? "hatch text-edge-strong ring-1 ring-edge-strong ring-inset" : "bg-well-strong")}
                    style={{ flexGrow: s.weight, flexBasis: 0 }}
                  >
                    {s.score !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-sky" style={{ width: `${s.score}%` }} />}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </MCard>
      <MCard>
        <MLabel right="form = 14d vs prior 28d">Skills</MLabel>
        <ul className="flex flex-col">
          {d.skills.map((s) => (
            <li key={s.key} className="flex min-h-[52px] items-center gap-3 border-t border-edge/70 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink">{s.name}</span>
                <Bar value={s.progress.ratio} size="sm" className="mt-1.5 w-32" label={`${s.name} progress`} />
              </span>
              <FormBadge form={s.form} metric={s.formMetric} />
              <span className="num w-12 text-right text-[15px] text-ink">Lv {s.progress.level}</span>
            </li>
          ))}
        </ul>
      </MCard>
      <MCard>
        {["Strength progression", "Goals & achievements", "Weekly summary"].map((x) => (
          <button key={x} type="button" className="flex h-12 w-full items-center justify-between border-t border-edge/70 text-[15px] text-ink first:border-t-0">
            {x}
            <ChevronRight size={18} className="text-ink-3" aria-hidden />
          </button>
        ))}
      </MCard>
    </div>
  );
}

/* ───────────────────────── Profile & sync ───────────────────────── */

export function ProfileScreen({ d }: { d: World }) {
  const latest = d.fitness.sessions[0];
  return (
    <div className="flex flex-col gap-3 pb-6">
      <ScreenHeader sub="Private, single-user account" title="Profile" />
      <MCard className="border-saffron-line">
        <MLabel right="2 waiting">Sync</MLabel>
        <ul className="flex flex-col">
          {[
            { t: `Workout · ${latest?.split ?? "Push"} day`, s: "Saved on this phone · waiting for connection" },
            { t: "Daily check-in", s: "Saved on this phone · waiting for connection" },
          ].map((x) => (
            <li key={x.t} className="flex items-center gap-3 border-t border-edge/70 py-2.5 first:border-t-0 first:pt-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-saffron" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-ink">{x.t}</span>
                <span className="block text-[12px] text-ink-3">{x.s}</span>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-well text-[14px] text-ink">
          <RefreshCw size={15} aria-hidden /> Try sync now
        </button>
        <p className="mt-2 text-[11px] text-ink-3">
          Each entry has a unique ID, so retries never create duplicates or double XP.
        </p>
      </MCard>
      <MCard>
        <MLabel>Settings</MLabel>
        {[
          { t: "Personal targets", v: "Lifts, sleep, steps" },
          { t: "Training split", v: "Push · Legs · Pull" },
          { t: "Units", v: "kg" },
          { t: "Week starts", v: "Monday" },
          { t: "Reminders", v: "Check-in 9:00" },
        ].map((x) => (
          <button key={x.t} type="button" className="flex min-h-12 w-full items-center gap-3 border-t border-edge/70 text-left first:border-t-0">
            <span className="flex-1 text-[15px] text-ink">{x.t}</span>
            <span className="text-[13px] text-ink-3">{x.v}</span>
            <ChevronRight size={16} className="text-ink-3" aria-hidden />
          </button>
        ))}
      </MCard>
      <MCard>
        <MLabel>Data</MLabel>
        {["Export my data", "Sign out"].map((x) => (
          <button key={x} type="button" className="flex h-12 w-full items-center justify-between border-t border-edge/70 text-[15px] text-ink-2 first:border-t-0">
            {x}
            <ChevronRight size={16} className="text-ink-3" aria-hidden />
          </button>
        ))}
      </MCard>
      <p className="px-6 text-center text-[11px] text-ink-3">Sample data · reminders are an example setting</p>
    </div>
  );
}
