"use client";

import { Bar as RBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookOpen, CalendarClock, Check, Code2, GraduationCap, Milestone as MilestoneIcon, Puzzle } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip, type Tone } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Bar } from "@/components/ui/progress";
import { AXIS, ChartTip, GRID, Legend } from "@/components/ui/chart";
import { Module } from "@/components/dashboard/module";
import { PageHeader } from "@/components/page/page-header";
import { Change, StatStrip } from "@/components/page/stat-strip";
import { DAY_MS, WEEKDAY_SHORT, addDays, formatRelativeDay, formatShortDate, formatTime, startOfDay, weekdayIndex } from "@/lib/dates";
import type { Assignment, Milestone } from "@/lib/sample/academics";

const dueLabel = (due: Date, now: Date) => {
  const n = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY_MS);
  return n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : n > 1 ? `Due in ${n} days` : n === -1 ? "Due yesterday" : `${-n} days ago`;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ───────────── Subjects ───────────── */

function Subjects() {
  return (
    <Module
      framed
      title="Subjects"
      subtitle="Current semester · syllabus units · focused study, last 28 days"
      className="xl:col-span-7"
      skeleton={{ rows: 4 }}
      empty={{ icon: BookOpen, title: "No subjects yet", description: "Add this semester’s subjects to track study time and syllabus progress." }}
    >
      {(d) => {
        const max = Math.max(...d.academics.subjects.map((s) => s.hours28), 1);
        return (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Subjects</caption>
              <thead>
                <tr className="text-2xs text-ink-3">
                  <th scope="col" className="pb-2 font-normal">Subject</th>
                  <th scope="col" className="w-44 pb-2 font-normal">Syllabus</th>
                  <th scope="col" className="w-40 pb-2 pl-4 font-normal">Study, 28 days</th>
                  <th scope="col" className="pb-2 text-right font-normal">Last studied</th>
                </tr>
              </thead>
              <tbody>
                {d.academics.subjects.map((s) => (
                  <tr key={s.key} className="border-t border-edge/70">
                    <td className="py-3 pr-3">
                      <p className="text-ink">{s.short}</p>
                      <p className="truncate text-2xs text-ink-3">
                        {s.name} · {s.credits} credits
                      </p>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Bar value={s.unitsDone / s.unitsTotal} tone="mint" size="sm" label={`${s.short} syllabus`} />
                        <span className="num shrink-0 text-2xs text-ink-2">
                          {s.unitsDone}/{s.unitsTotal}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 rounded-full bg-sky" style={{ width: `${Math.max(4, (s.hours28 / max) * 70)}%` }} aria-hidden />
                        <span className="num shrink-0 text-2xs text-ink-2">
                          {s.hours28} h · {s.sessions28}×
                        </span>
                      </div>
                    </td>
                    <td className="num py-3 text-right text-2xs text-ink-3">{s.lastStudied ? formatRelativeDay(s.lastStudied, d.now) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Assignments ───────────── */

const STATUS: Record<Assignment["status"], { label: string; tone: Tone }> = {
  "not-started": { label: "Not started", tone: "neutral" },
  "in-progress": { label: "In progress", tone: "saffron" },
  submitted: { label: "Submitted", tone: "mint" },
  graded: { label: "Graded", tone: "mint" },
};

function Assignments() {
  return (
    <Module
      framed
      title="Assignments & deadlines"
      subtitle="Sorted by due date · next 7 days and recently closed"
      className="xl:col-span-5"
      skeleton={{ rows: 5 }}
      empty={{ icon: CalendarClock, title: "No assignments", description: "Add assignments with due dates to see deadlines here.", action: "Add assignment" }}
    >
      {(d) => {
        const open = d.academics.assignments.filter((a) => a.status === "not-started" || a.status === "in-progress");
        const closed = d.academics.assignments.filter((a) => !open.includes(a));
        const row = (a: Assignment) => {
          const days = Math.round((startOfDay(a.due).getTime() - startOfDay(d.now).getTime()) / DAY_MS);
          const urgent = open.includes(a) && days <= 1;
          return (
            <li key={a.id} className="flex items-center gap-3 border-t border-edge/70 py-2.5 first:border-t-0">
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-box text-center leading-none",
                  urgent ? "bg-saffron-soft text-saffron" : "bg-well text-ink-2",
                )}
              >
                <span>
                  <span className="block text-[10px]">{WEEKDAY_SHORT[weekdayIndex(a.due)]}</span>
                  <span className="num block text-sm">{a.due.getDate()}</span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{a.title}</span>
                <span className={cn("block text-2xs", urgent ? "text-saffron" : "text-ink-3")}>
                  {a.subject} · {dueLabel(a.due, d.now)}
                </span>
              </span>
              <Chip tone={STATUS[a.status].tone}>
                {STATUS[a.status].label}
                {a.grade && <span className="num"> · {a.grade}</span>}
              </Chip>
            </li>
          );
        };
        return (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col">{open.map(row)}</ul>
            <p className="text-2xs text-ink-3">Recently closed</p>
            <ul className="flex flex-col opacity-80">{closed.map(row)}</ul>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Sessions timeline ───────────── */

const H0 = 6;
const H1 = 24;

function SessionsTimeline() {
  return (
    <Module
      framed
      title="Study & coding sessions"
      subtitle="Last 7 days · each block is a focused session, placed by time of day"
      className="xl:col-span-7"
      skeleton={{ rows: 7 }}
      actions={() => (
        <MethodInfo label="session XP">
          Focused study earns 1 XP per 3 minutes (60 per session max) and coding 1 XP per 2.5 minutes (80 max), for
          Learning and Programming. Time shows effort, not skill: outcome evidence such as solved problems, milestones
          and assessments counts separately.
        </MethodInfo>
      )}
      empty={{ icon: BookOpen, title: "No sessions yet", description: "Focused study and coding sessions you log appear on this timeline.", action: "Log study session" }}
    >
      {(d) => {
        const today = startOfDay(d.now);
        const days = Array.from({ length: 7 }, (_, k) => addDays(today, -6 + k));
        const pos = (date: Date) => ((date.getHours() + date.getMinutes() / 60 - H0) / (H1 - H0)) * 100;
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <Legend items={[{ label: "Study", color: "var(--sky)" }, { label: "Coding", color: "var(--lilac)" }]} />
              <span className="num ml-auto text-2xs text-ink-3">
                {d.academics.studyHours14} h study · {d.academics.codingHours14} h coding in 14 days
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="ml-16 grid grid-cols-6 text-[10px] text-ink-3" aria-hidden>
                {[6, 9, 12, 15, 18, 21].map((h) => (
                  <span key={h} className="num">
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {days.map((day) => {
                const items = d.academics.sessions.filter((s) => startOfDay(s.start).getTime() === day.getTime());
                const total = items.reduce((a, s) => a + s.minutes, 0);
                return (
                  <div key={day.getTime()} className="flex items-center gap-3">
                    <span className="w-13 shrink-0 text-xs text-ink-3">
                      {day.getTime() === today.getTime() ? "Today" : `${WEEKDAY_SHORT[weekdayIndex(day)]} ${day.getDate()}`}
                    </span>
                    <div className="relative h-7 flex-1 rounded-ctl bg-well/60">
                      {[0, 1, 2, 3, 4, 5].map((k) => (
                        <span key={k} aria-hidden className="absolute inset-y-0 w-px bg-edge/70" style={{ left: `${(k / 6) * 100}%` }} />
                      ))}
                      {items.map((s) => {
                        const left = Math.max(0, pos(s.start));
                        const width = Math.min(100 - left, (s.minutes / 60 / (H1 - H0)) * 100);
                        return (
                          <span
                            key={s.id}
                            title={`${s.kind === "study" ? "Study" : "Coding"} · ${s.label} · ${formatTime(s.start)} · ${s.minutes} min`}
                            className={cn(
                              "absolute top-1 bottom-1 overflow-hidden rounded-[6px] px-1.5 text-[10px] leading-5 whitespace-nowrap text-base",
                              s.kind === "study" ? "bg-sky" : "bg-lilac",
                            )}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {s.label}
                          </span>
                        );
                      })}
                    </div>
                    <span className="num w-12 shrink-0 text-right text-2xs text-ink-2">{total ? `${(total / 60).toFixed(1)} h` : "—"}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-2xs text-ink-3">
              Study 14 days: <Change now={d.academics.studyHours14} prev={d.academics.prevStudyHours14} suffix="vs prior 14" /> · Coding:{" "}
              <Change now={d.academics.codingHours14} prev={d.academics.prevCodingHours14} suffix="vs prior 14" />
            </p>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── DSA ───────────── */

function Dsa() {
  return (
    <Module
      framed
      title="DSA progress"
      subtitle="Problems solved · outcome evidence for the DSA skill"
      className="xl:col-span-5"
      skeleton={{ rows: 5 }}
      actions={() => (
        <MethodInfo label="DSA XP">
          Each solved problem earns DSA XP by difficulty: Easy 10, Medium 20, Hard 35. Time spent alone earns no DSA XP.
          DSA form uses difficulty-weighted problems per day (Easy 1, Medium 2, Hard 3).
        </MethodInfo>
      )}
      empty={{ icon: Puzzle, title: "No problems logged", description: "Log solved problems with difficulty and topic." }}
    >
      {(d) => {
        const x = d.academics.dsa;
        const prevMilestone = x.nextMilestone - 50;
        const diffs: { k: "E" | "M" | "H"; label: string; color: string }[] = [
          { k: "E", label: "Easy", color: "var(--mint)" },
          { k: "M", label: "Medium", color: "var(--sky)" },
          { k: "H", label: "Hard", color: "var(--lilac)" },
        ];
        const maxTopic = Math.max(...x.byTopic.map((t) => t.solved), 1);
        const maxWeek = Math.max(...x.weekly.map((w) => w.count), 1);
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-end gap-4">
              <p>
                <span className="font-display text-[40px] leading-none font-semibold tracking-[-0.04em] text-ink">{x.lifetime}</span>
                <span className="ml-1.5 text-xs text-ink-3">solved</span>
              </p>
              <div className="flex-1 pb-1">
                <p className="num mb-1 flex justify-between text-2xs text-ink-3">
                  <span>+{x.window} in 8 weeks</span>
                  <span>
                    next milestone <span className="text-saffron">{x.nextMilestone}</span>
                  </span>
                </p>
                <Bar value={(x.lifetime - prevMilestone) / 50} label={`Progress to ${x.nextMilestone} problems`} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-ink-2">By difficulty · 8 weeks</p>
              <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
                {diffs.map((t) => (
                  <span key={t.k} style={{ flexGrow: x.byDifficulty[t.k], background: t.color }} />
                ))}
              </div>
              <ul className="num mt-1.5 flex gap-4 text-2xs text-ink-2">
                {diffs.map((t) => (
                  <li key={t.k} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color }} aria-hidden />
                    {t.label} {x.byDifficulty[t.k]}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-ink-2">By topic · 8 weeks</p>
              <ul className="flex flex-col gap-1.5">
                {x.byTopic.map((t) => (
                  <li key={t.topic} className="flex items-center gap-3 text-xs">
                    <span className="w-36 shrink-0 truncate text-ink-2">{t.topic}</span>
                    <span className="h-1.5 rounded-full bg-sky/80" style={{ width: `${(t.solved / maxTopic) * 55}%` }} aria-hidden />
                    <span className="num text-2xs text-ink-3">{t.solved}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figure aria-label="Problems solved per week, last 8 weeks">
              <p className="mb-1.5 text-xs text-ink-2">Per week</p>
              <div className="flex h-12 items-end gap-1.5">
                {x.weekly.map((w) => (
                  <span
                    key={w.weekStart.getTime()}
                    title={`Week of ${formatShortDate(w.weekStart)}: ${w.count}`}
                    className={cn("flex-1 rounded-t-[4px]", w.count ? "bg-sky/70" : "h-0.5 bg-edge-strong")}
                    style={w.count ? { height: `${(w.count / maxWeek) * 100}%` } : undefined}
                  />
                ))}
              </div>
              <figcaption className="num mt-1 flex justify-between text-[10px] text-ink-3">
                <span>{formatShortDate(x.weekly[0].weekStart)}</span>
                <span>this week</span>
              </figcaption>
            </figure>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Milestones ───────────── */

function MilestoneList({ items, now }: { items: Milestone[]; now: Date }) {
  return (
    <ol className="relative flex flex-col gap-3 border-l border-edge-strong pl-5">
      {items.map((m) => (
        <li key={m.id} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute top-1 -left-[27px] grid h-3.5 w-3.5 place-items-center rounded-full",
              m.done ? "bg-mint text-base" : "border-[1.5px] border-dashed border-ink-3 bg-slab",
            )}
          >
            {m.done && <Check size={9} strokeWidth={4} />}
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-sm", m.done ? "text-ink" : "text-ink-2")}>{m.title}</span>
            {m.detail && <span className="num text-xs text-mint">{m.detail}</span>}
          </div>
          <p className="text-2xs text-ink-3">
            {m.kind === "assessment" ? "Assessment" : m.kind === "project" ? "Project" : "Learning"} ·{" "}
            {m.done ? formatShortDate(m.date) : dueLabel(m.date, now).replace("Due", "Planned")}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Milestones() {
  return (
    <Module
      framed
      title="Learning & project milestones"
      subtitle="Outcome evidence for Learning, Intelligence and Backend Development"
      className="xl:col-span-7"
      skeleton={{ rows: 6 }}
      empty={{ icon: MilestoneIcon, title: "No milestones", description: "Milestones and assessment results are the strongest learning evidence." }}
    >
      {(d) => {
        const recent = d.academics.milestones.filter((m) => m.done && m.date >= addDays(startOfDay(d.now), -90)).length;
        return (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs text-ink-2">
                Learning & assessments ·{" "}
                <span className="text-ink-3">{recent} completed in 90 days (the Intelligence target is 6)</span>
              </p>
              <MilestoneList items={d.academics.milestones} now={d.now} />
            </div>
            <div>
              <p className="mb-3 text-xs text-ink-2">Projects · Backend Development</p>
              <MilestoneList items={d.academics.projectMilestones} now={d.now} />
              <p className="mt-4 rounded-box bg-well p-3 text-2xs text-ink-3">
                <Code2 size={12} className="mr-1 inline text-ink-3" aria-hidden />
                No project milestone was completed in the last 8 weeks, so Backend Development shows no form yet.
              </p>
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── Semester record ───────────── */

function Record() {
  return (
    <Module
      framed
      title="Semester record"
      subtitle="SGPA per semester, of 10 · CGPA weighted by credits"
      className="xl:col-span-5"
      skeleton={{ rows: 1, block: true }}
      actions={() => (
        <MethodInfo label="CGPA">
          CGPA = Σ(SGPA × semester credits) ÷ Σ(credits) over completed semesters. The current semester is excluded until
          its results are entered.
        </MethodInfo>
      )}
      empty={{ icon: GraduationCap, title: "No academic records", description: "Enter semester results to see SGPA and CGPA." }}
    >
      {(d) => {
        const rows = d.academics.semesters.map((s) => ({ label: s.label, sgpa: s.sgpa, credits: s.credits }));
        return (
          <div className="flex flex-col gap-4">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-[40px] leading-none font-semibold tracking-[-0.04em] text-ink">{d.academics.cgpa.toFixed(2)}</span>
              <span className="text-xs text-ink-3">CGPA after {rows.filter((r) => r.sgpa !== null).length} semesters</span>
            </p>
            <div className="h-44" role="img" aria-label={`SGPA by semester: ${rows.map((r) => `${r.label} ${r.sgpa ?? "in progress"}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap="30%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} domain={[7, 10]} ticks={[7, 8, 9, 10]} width={40} />
                  <Tooltip
                    cursor={{ fill: "var(--well)", opacity: 0.6 }}
                    content={(p) => <ChartTip active={p.active} label={p.label as string} rows={p.payload} format={(v) => v.toFixed(2)} />}
                  />
                  <RBar dataKey="sgpa" name="SGPA" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {rows.map((r, i) => (
                      <Cell key={r.label} fill={i === rows.length - 2 ? "var(--saffron)" : "var(--sky)"} />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-2xs text-ink-3">Sem 5 is in progress, so it has no SGPA yet. The latest result is highlighted.</p>
          </div>
        );
      }}
    </Module>
  );
}

export function AcademicsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Academics"
        description="Subjects, study and coding sessions, DSA, assignments and results. Outcomes such as solved problems, milestones and grades count as stronger evidence than hours."
        action="Log study session"
      />
      <StatStrip
        labels={["Focused study, 14 days", "Coding, 14 days", "DSA problems solved", "Next deadline"]}
        stats={(d) => {
          const a = d.academics;
          const nextDue = a.assignments.filter((x) => x.status === "not-started" || x.status === "in-progress").sort((x, y) => x.due.getTime() - y.due.getTime())[0];
          return [
            { label: "Focused study, 14 days", value: a.studyHours14.toFixed(1), unit: "h", note: <Change now={a.studyHours14} prev={a.prevStudyHours14} suffix="vs prior 14 days" /> },
            { label: "Coding, 14 days", value: a.codingHours14.toFixed(1), unit: "h", note: <Change now={a.codingHours14} prev={a.prevCodingHours14} suffix="vs prior 14 days" /> },
            { label: "DSA problems solved", value: String(a.dsa.lifetime), accent: true, note: `+${a.dsa.window} in the last 8 weeks` },
            { label: "Next deadline", value: nextDue ? cap(dueLabel(nextDue.due, d.now).replace("Due ", "")) : "None", note: nextDue ? nextDue.title : "no open assignments" },
          ];
        }}
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <Subjects />
        <Assignments />
        <SessionsTimeline />
        <Dsa />
        <Milestones />
        <Record />
      </div>
    </div>
  );
}
