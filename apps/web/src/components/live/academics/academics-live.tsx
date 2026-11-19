"use client";

import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { BookOpen, CalendarClock, Check, ChevronDown, GraduationCap, Milestone as MilestoneIcon, Minus, Plus, Puzzle, RotateCw } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { Chip, type Tone } from "@/components/ui/chip";
import { MethodInfo } from "@/components/ui/info";
import { Bar } from "@/components/ui/progress";
import { Legend } from "@/components/ui/chart";
import { SkeletonRows, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Change } from "@/components/page/stat-strip";
import { LiveChip, LivePanel, Notice } from "@/components/live/live-panel";
import { api } from "@/lib/api/client";
import type { AcademicsSummary, Assignment, AssignmentStatus, Milestone, Semester, Subject } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { WEEKDAY_SHORT, formatShortDate, formatTime, weekdayIndex } from "@/lib/dates";
import { addDaysIso, todayIso } from "@/lib/local-date";
import { AssignmentDialog, LogSessionDialog, MilestoneDialog, ProblemDialog, SemesterDialog, SubjectDialog, errorText, updateAssignment } from "./dialogs";

const DAY = 86_400_000;
const daysUntil = (iso: string) => {
  const due = new Date(iso);
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((a - b) / DAY);
};
const dueLabel = (iso: string) => {
  const n = daysUntil(iso);
  return n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : n > 1 ? `Due in ${n} days` : n === -1 ? "Due yesterday" : `${-n} days ago`;
};
const relDay = (iso: string | null) => {
  if (!iso) return "—";
  const n = -daysUntil(iso);
  return n === 0 ? "Today" : n === 1 ? "Yesterday" : n < 7 ? WEEKDAY_SHORT[weekdayIndex(new Date(iso))] : formatShortDate(new Date(iso));
};

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick}>
      <Plus size={13} aria-hidden /> {label}
    </Button>
  );
}

/* ───────────── stats ───────────── */

function Stats({ s }: { s: AcademicsSummary | undefined }) {
  const cells = s
    ? [
        { label: "Focused study, 14 days", value: s.study_hours_14d.toFixed(1), unit: "h", note: <Change now={s.study_hours_14d} prev={s.prev_study_hours_14d} suffix="vs prior 14 days" /> },
        { label: "Coding, 14 days", value: s.coding_hours_14d.toFixed(1), unit: "h", note: <Change now={s.coding_hours_14d} prev={s.prev_coding_hours_14d} suffix="vs prior 14 days" /> },
        { label: "DSA problems solved", value: String(s.dsa.lifetime), accent: true, note: `+${s.dsa.window} in the last 8 weeks` },
        {
          label: "Next deadline",
          value: s.next_deadline ? dueLabel(s.next_deadline.due_at).replace("Due ", "").replace(/^./, (c) => c.toUpperCase()) : "None",
          note: s.next_deadline?.title ?? "no open assignments",
        },
      ]
    : null;
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-px overflow-hidden rounded-slab border border-edge bg-edge lg:grid-cols-4">
      {(cells ?? [0, 1, 2, 3].map(() => null)).map((c, i) => (
        <div key={i} className="min-w-0 bg-slab px-5 py-4">
          {c ? (
            <>
              <p className="truncate text-xs text-ink-3">{c.label}</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className={cn("font-display text-[30px] leading-8 font-semibold tracking-[-0.03em]", "accent" in c && c.accent ? "text-saffron" : "text-ink")}>{c.value}</span>
                {"unit" in c && c.unit && <span className="text-sm text-ink-3">{c.unit}</span>}
              </p>
              <p className="num mt-0.5 truncate text-2xs text-ink-3">{c.note}</p>
            </>
          ) : (
            <div className="flex flex-col gap-2 py-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-6 w-16 rounded-ctl" />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

/* ───────────── subjects ───────────── */

function Subjects({ subjects, loading, onAdd, onChanged }: { subjects: Subject[] | undefined; loading: boolean; onAdd: () => void; onChanged: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const max = Math.max(1, ...(subjects ?? []).map((s) => s.hours_28d));
  const step = async (s: Subject, delta: number) => {
    setNotice(null);
    try {
      await api(`/subjects/${s.id}`, { method: "PATCH", version: s.version, body: { units_done: s.units_done + delta } });
    } catch (e) {
      setNotice(errorText(e));
    }
    onChanged();
  };
  return (
    <LivePanel title="Subjects" subtitle="Syllabus units · focused study, last 28 days" className="xl:col-span-7" actions={<AddButton label="Subject" onClick={onAdd} />}>
      {notice && (
        <div className="mb-3">
          <Notice tone="coral">{notice}</Notice>
        </div>
      )}
      {loading ? (
        <SkeletonRows rows={4} />
      ) : !subjects?.length ? (
        <EmptyState icon={BookOpen} title="No subjects yet" description="Add this semester’s subjects to track study time and syllabus progress." action={<AddButton label="Add subject" onClick={onAdd} />} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Subjects</caption>
            <thead>
              <tr className="text-2xs text-ink-3">
                <th scope="col" className="pb-2 font-normal">Subject</th>
                <th scope="col" className="w-52 pb-2 font-normal">Syllabus</th>
                <th scope="col" className="w-36 pb-2 pl-4 font-normal">Study, 28 days</th>
                <th scope="col" className="pb-2 text-right font-normal">Last studied</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-t border-edge/70">
                  <td className="py-3 pr-3">
                    <p className="text-ink">{s.short_name}</p>
                    <p className="truncate text-2xs text-ink-3">
                      {s.name}
                      {s.credits !== null && ` · ${s.credits} credits`}
                    </p>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`One unit less for ${s.short_name}`} disabled={s.units_done <= 0} onClick={() => void step(s, -1)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-well text-ink-2 disabled:opacity-30">
                        <Minus size={12} />
                      </button>
                      <Bar value={s.units_total ? s.units_done / s.units_total : 0} tone="mint" size="sm" label={`${s.short_name} syllabus`} />
                      <button type="button" aria-label={`One more unit done for ${s.short_name}`} disabled={s.units_done >= s.units_total} onClick={() => void step(s, 1)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-well text-ink-2 disabled:opacity-30">
                        <Plus size={12} />
                      </button>
                      <span className="num shrink-0 text-2xs text-ink-2">
                        {s.units_done}/{s.units_total}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 rounded-full bg-sky" style={{ width: `${Math.max(4, (s.hours_28d / max) * 60)}%` }} aria-hidden />
                      <span className="num shrink-0 text-2xs text-ink-2">
                        {s.hours_28d} h · {s.sessions_28d}×
                      </span>
                    </div>
                  </td>
                  <td className="num py-3 text-right text-2xs text-ink-3">{relDay(s.last_studied_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── assignments ───────────── */

const STATUS: Record<AssignmentStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "saffron" },
  submitted: { label: "Submitted", tone: "mint" },
  graded: { label: "Graded", tone: "mint" },
};

function Assignments({ items, subjects, loading, onAdd, onChanged }: { items: Assignment[] | undefined; subjects: Subject[]; loading: boolean; onAdd: () => void; onChanged: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const short = Object.fromEntries(subjects.map((s) => [s.id, s.short_name]));
  const open = (items ?? []).filter((a) => a.status === "not_started" || a.status === "in_progress");
  const closed = (items ?? []).filter((a) => !open.includes(a)).slice(-5).reverse();
  const setStatus = async (a: Assignment, status: AssignmentStatus) => {
    setNotice(null);
    try {
      await updateAssignment(a, { status, ...(status !== "graded" ? { grade_score: null, grade_max: null } : {}) });
    } catch (e) {
      setNotice(errorText(e));
    }
    onChanged();
  };
  const row = (a: Assignment) => {
    const d = daysUntil(a.due_at);
    const urgent = open.includes(a) && d <= 1;
    const due = new Date(a.due_at);
    return (
      <li key={a.id} className="flex items-center gap-3 border-t border-edge/70 py-2.5 first:border-t-0">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-box text-center leading-none", urgent ? "bg-saffron-soft text-saffron" : "bg-well text-ink-2")}>
          <span>
            <span className="block text-[10px]">{WEEKDAY_SHORT[weekdayIndex(due)]}</span>
            <span className="num block text-sm">{due.getDate()}</span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{a.title}</span>
          <span className={cn("block text-2xs", urgent ? "text-saffron" : "text-ink-3")}>
            {short[a.subject_id] ?? "—"} · {dueLabel(a.due_at)}
          </span>
        </span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger aria-label={`Status of ${a.title}: ${STATUS[a.status].label}`} className="flex items-center gap-1 rounded-full">
            <Chip tone={STATUS[a.status].tone}>
              {STATUS[a.status].label}
              {a.grade_score !== null && <span className="num"> · {a.grade_score}/{a.grade_max}</span>}
              <ChevronDown size={11} aria-hidden />
            </Chip>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-40 rounded-box border border-edge-strong bg-slab p-1.5 shadow-2xl shadow-black/60">
              {(Object.keys(STATUS) as AssignmentStatus[])
                .filter((k) => k !== "graded")
                .map((k) => (
                  <DropdownMenu.Item key={k} onSelect={() => void setStatus(a, k)} className="flex h-8 cursor-pointer items-center gap-2 rounded-ctl px-2.5 text-sm text-ink-2 outline-none data-[highlighted]:bg-well data-[highlighted]:text-ink">
                    {a.status === k ? <Check size={13} aria-hidden /> : <span className="w-[13px]" />}
                    {STATUS[k].label}
                  </DropdownMenu.Item>
                ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </li>
    );
  };
  return (
    <LivePanel title="Assignments & deadlines" subtitle="Sorted by due date · change status from the chip" className="xl:col-span-5" actions={subjects.length ? <AddButton label="Assignment" onClick={onAdd} /> : undefined}>
      {notice && (
        <div className="mb-3">
          <Notice tone="coral">{notice}</Notice>
        </div>
      )}
      {loading ? (
        <SkeletonRows rows={4} />
      ) : !items?.length ? (
        <EmptyState
          icon={CalendarClock}
          title="No assignments"
          description={subjects.length ? "Add assignments with due dates to see deadlines here." : "Add a subject first, then its assignments."}
          action={subjects.length ? <AddButton label="Add assignment" onClick={onAdd} /> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col">{open.length ? open.map(row) : <li className="text-xs text-ink-3">Nothing open. Nice.</li>}</ul>
          {closed.length > 0 && (
            <>
              <p className="text-2xs text-ink-3">Recently closed</p>
              <ul className="flex flex-col opacity-80">{closed.map(row)}</ul>
            </>
          )}
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── sessions timeline ───────────── */

function Timeline({ s, loading, onLog }: { s: AcademicsSummary | undefined; loading: boolean; onLog: () => void }) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, k) => addDaysIso(today, k - 6));
  const H0 = 6,
    H1 = 24;
  const pos = (d: Date) => ((d.getHours() + d.getMinutes() / 60 - H0) / (H1 - H0)) * 100;
  const dayOf = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  return (
    <LivePanel
      title="Study & coding sessions"
      subtitle="Last 7 days · each block is a session, placed by time of day"
      className="xl:col-span-7"
      actions={
        <>
          <MethodInfo label="session XP">
            Study earns 1 XP per 3 focused minutes (60 per session max), coding 1 per 2.5 minutes (80 max). XP is added by the server once the progression engine is live (Phase 5).
          </MethodInfo>
          <AddButton label="Log" onClick={onLog} />
        </>
      }
    >
      {loading ? (
        <SkeletonRows rows={7} />
      ) : !s?.sessions_7d.length ? (
        <EmptyState icon={BookOpen} title="No sessions this week" description="Log a focused study or coding session; it appears here by time of day." action={<AddButton label="Log session" onClick={onLog} />} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <Legend items={[{ label: "Study", color: "var(--sky)" }, { label: "Coding", color: "var(--lilac)" }]} />
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
              const items = s.sessions_7d.filter((x) => dayOf(x.start) === day);
              const total = items.reduce((a, x) => a + x.minutes, 0);
              const d = new Date(`${day}T12:00`);
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-13 shrink-0 text-xs text-ink-3">{day === today ? "Today" : `${WEEKDAY_SHORT[weekdayIndex(d)]} ${d.getDate()}`}</span>
                  <div className="relative h-7 flex-1 rounded-ctl bg-well/60">
                    {items.map((x) => {
                      const start = new Date(x.start);
                      const left = Math.max(0, pos(start));
                      const width = Math.max(1.2, Math.min(100 - left, (x.minutes / 60 / (H1 - H0)) * 100));
                      return (
                        <span
                          key={x.id}
                          title={`${x.kind === "study" ? "Study" : "Coding"} · ${x.label} · ${formatTime(start)} · ${x.minutes} min`}
                          className={cn("absolute top-1 bottom-1 overflow-hidden rounded-[6px] px-1.5 text-[10px] leading-5 whitespace-nowrap text-base", x.kind === "study" ? "bg-sky" : "bg-lilac")}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {x.label}
                        </span>
                      );
                    })}
                  </div>
                  <span className="num w-12 shrink-0 text-right text-2xs text-ink-2">{total ? `${(total / 60).toFixed(1)} h` : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── DSA ───────────── */

function Dsa({ s, loading, onLog }: { s: AcademicsSummary | undefined; loading: boolean; onLog: () => void }) {
  const x = s?.dsa;
  const diffs = [
    { k: "easy" as const, label: "Easy", color: "var(--mint)" },
    { k: "medium" as const, label: "Medium", color: "var(--sky)" },
    { k: "hard" as const, label: "Hard", color: "var(--lilac)" },
  ];
  const next = x ? Math.ceil((x.lifetime + 1) / 50) * 50 : 50;
  return (
    <LivePanel
      title="DSA progress"
      subtitle="Solved problems · outcome evidence for the DSA skill"
      className="xl:col-span-5"
      actions={
        <>
          <MethodInfo label="DSA XP">Each solved problem earns DSA XP by difficulty: Easy 10, Medium 20, Hard 35. Time alone earns no DSA XP. A problem URL can only count once.</MethodInfo>
          <AddButton label="Problem" onClick={onLog} />
        </>
      }
    >
      {loading || !x ? (
        <SkeletonRows rows={5} />
      ) : x.lifetime === 0 ? (
        <EmptyState icon={Puzzle} title="No problems logged" description="Log solved problems with difficulty and topic, or add them to a coding session." action={<AddButton label="Log problem" onClick={onLog} />} />
      ) : (
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
                  next milestone <span className="text-saffron">{next}</span>
                </span>
              </p>
              <Bar value={(x.lifetime - (next - 50)) / 50} label={`Progress to ${next} problems`} />
            </div>
          </div>
          {x.window > 0 && (
            <>
              <div>
                <p className="mb-1.5 text-xs text-ink-2">By difficulty · 8 weeks</p>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-well" aria-hidden>
                  {diffs.map((d) => (
                    <span key={d.k} style={{ flexGrow: x.by_difficulty[d.k], background: d.color }} />
                  ))}
                </div>
                <ul className="num mt-1.5 flex gap-4 text-2xs text-ink-2">
                  {diffs.map((d) => (
                    <li key={d.k} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: d.color }} aria-hidden />
                      {d.label} {x.by_difficulty[d.k]}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-ink-2">By topic · 8 weeks</p>
                <ul className="flex flex-col gap-1.5">
                  {x.by_topic.slice(0, 6).map((t) => (
                    <li key={t.topic} className="flex items-center gap-3 text-xs">
                      <span className="w-36 shrink-0 truncate text-ink-2">{t.topic}</span>
                      <span className="h-1.5 rounded-full bg-sky/80" style={{ width: `${(t.solved / x.by_topic[0].solved) * 55}%` }} aria-hidden />
                      <span className="num text-2xs text-ink-3">{t.solved}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── milestones ───────────── */

function Milestones({ items, loading, onAdd, onChanged }: { items: Milestone[] | undefined; loading: boolean; onAdd: () => void; onChanged: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const complete = async (m: Milestone) => {
    setNotice(null);
    try {
      await api(`/milestones/${m.id}`, { method: "PATCH", version: m.version, body: { completed_at: m.completed_at ? null : new Date().toISOString() } });
    } catch (e) {
      setNotice(errorText(e));
    }
    onChanged();
  };
  const [now] = useState(() => Date.now());
  const ninety = now - 90 * DAY;
  const recent = (items ?? []).filter((m) => m.kind !== "project" && m.completed_at && new Date(m.completed_at).getTime() >= ninety).length;
  return (
    <LivePanel title="Learning & project milestones" subtitle="Outcome evidence · tick when done" className="xl:col-span-7" actions={<AddButton label="Milestone" onClick={onAdd} />}>
      {notice && (
        <div className="mb-3">
          <Notice tone="coral">{notice}</Notice>
        </div>
      )}
      {loading ? (
        <SkeletonRows rows={5} />
      ) : !items?.length ? (
        <EmptyState icon={MilestoneIcon} title="No milestones" description="Milestones and assessment results are the strongest learning evidence." action={<AddButton label="Add milestone" onClick={onAdd} />} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-3">{recent} learning or assessment milestones completed in the last 90 days</p>
          <ol className="relative flex flex-col gap-3 border-l border-edge-strong pl-5">
            {items.map((m) => (
              <li key={m.id} className="relative">
                <button
                  type="button"
                  onClick={() => void complete(m)}
                  aria-label={m.completed_at ? `Mark “${m.title}” not done` : `Mark “${m.title}” done`}
                  className={cn("absolute top-1 -left-[27px] grid h-3.5 w-3.5 place-items-center rounded-full", m.completed_at ? "bg-mint text-base" : "border-[1.5px] border-dashed border-ink-3 bg-slab hover:border-mint")}
                >
                  {m.completed_at && <Check size={9} strokeWidth={4} />}
                </button>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn("text-sm", m.completed_at ? "text-ink" : "text-ink-2")}>{m.title}</span>
                  {m.score !== null && (
                    <span className="num text-xs text-mint">
                      {m.score} / {m.max_score}
                    </span>
                  )}
                </div>
                <p className="text-2xs text-ink-3">
                  {m.kind === "assessment" ? "Assessment" : m.kind === "project" ? `Project · ${m.project}` : "Learning"} ·{" "}
                  {m.completed_at ? `done ${formatShortDate(new Date(m.completed_at))}` : m.planned_for ? `planned ${formatShortDate(new Date(`${m.planned_for}T12:00`))}` : "planned"}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── semesters ───────────── */

function Semesters({ data, loading, onAdd, onChanged }: { data: { semesters: Semester[]; cgpa: number | null } | undefined; loading: boolean; onAdd: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const save = async (s: Semester) => {
    setNotice(null);
    try {
      await api(`/semesters/${s.id}`, { method: "PATCH", version: s.version, body: { sgpa: value === "" ? null : Number(value), is_current: value === "" } });
      setEditing(null);
    } catch (e) {
      setNotice(errorText(e));
    }
    onChanged();
  };
  return (
    <LivePanel
      title="Semester record"
      subtitle="SGPA of 10 · CGPA weighted by credits"
      className="xl:col-span-5"
      actions={
        <>
          <MethodInfo label="CGPA">CGPA = Σ(SGPA × credits) ÷ Σ(credits) over semesters that have both. Computed by the server.</MethodInfo>
          <AddButton label="Semester" onClick={onAdd} />
        </>
      }
    >
      {notice && (
        <div className="mb-3">
          <Notice tone="coral">{notice}</Notice>
        </div>
      )}
      {loading ? (
        <SkeletonRows rows={4} />
      ) : !data?.semesters.length ? (
        <EmptyState icon={GraduationCap} title="No academic records" description="Add your semesters and their SGPA to see your CGPA." action={<AddButton label="Add semester" onClick={onAdd} />} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-[40px] leading-none font-semibold tracking-[-0.04em] text-ink">{data.cgpa?.toFixed(2) ?? "—"}</span>
            <span className="text-xs text-ink-3">CGPA</span>
          </p>
          <ul className="flex flex-col gap-2">
            {data.semesters.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-xs">
                <span className="w-14 shrink-0 text-ink-2">{s.label}</span>
                <span className="flex-1">
                  <Bar value={s.sgpa ? s.sgpa / 10 : 0} tone={s.sgpa ? "sky" : "ink"} size="md" label={`${s.label} SGPA`} />
                </span>
                {editing === s.id ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(s);
                    }}
                  >
                    <input aria-label={`${s.label} SGPA`} type="number" min={0} max={10} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} autoFocus className="h-7 w-16 rounded-ctl border border-edge-strong bg-base px-2 text-xs text-ink" />
                    <button type="submit" className="h-7 rounded-ctl bg-saffron px-2 text-2xs font-semibold text-saffron-ink">
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(s.id);
                      setValue(s.sgpa?.toString() ?? "");
                    }}
                    className="num w-16 text-right text-ink hover:text-saffron"
                    aria-label={`Edit ${s.label} SGPA`}
                  >
                    {s.sgpa?.toFixed(2) ?? <span className="text-ink-3">in progress</span>}
                  </button>
                )}
                <span className="num w-12 text-right text-2xs text-ink-3">{s.credits ?? "—"} cr</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </LivePanel>
  );
}

/* ───────────── page ───────────── */

export function AcademicsLive() {
  const summary = useResource<AcademicsSummary>("/study/analytics");
  const assignments = useResource<Assignment[]>("/assignments");
  const milestones = useResource<Milestone[]>("/milestones");
  const semesters = useResource<{ semesters: Semester[]; cgpa: number | null }>("/semesters");
  const [dialog, setDialog] = useState<null | "session" | "subject" | "assignment" | "milestone" | "semester" | "problem">(null);
  const subjects = summary.data?.subjects ?? [];

  const reloadAll = () => {
    void summary.reload();
    void assignments.reload();
    void milestones.reload();
    void semesters.reload();
  };
  const failed = [summary, assignments, milestones, semesters].find((r) => r.status === "error" && !r.data);
  const close = (o: boolean) => !o && setDialog(null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">
          <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-ink">
            Academics<span className="text-saffron">.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink-2">
            Subjects, study and coding sessions, DSA, assignments and results. Outcomes such as solved problems, milestones and grades count as stronger evidence than hours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveChip />
          <button type="button" onClick={reloadAll} aria-label="Refresh" className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
            <RotateCw size={15} aria-hidden />
          </button>
          <Button variant="primary" onClick={() => setDialog("session")}>
            <Plus size={15} strokeWidth={2.5} aria-hidden /> Log session
          </Button>
        </div>
      </header>

      {failed ? (
        <ErrorState what="academics" onRetry={reloadAll} />
      ) : (
        <>
          <Stats s={summary.data} />
          <div className="grid gap-5 xl:grid-cols-12">
            <Subjects subjects={summary.data?.subjects} loading={summary.status === "loading"} onAdd={() => setDialog("subject")} onChanged={reloadAll} />
            <Assignments items={assignments.data} subjects={subjects} loading={assignments.status === "loading"} onAdd={() => setDialog("assignment")} onChanged={reloadAll} />
            <Timeline s={summary.data} loading={summary.status === "loading"} onLog={() => setDialog("session")} />
            <Dsa s={summary.data} loading={summary.status === "loading"} onLog={() => setDialog("problem")} />
            <Milestones items={milestones.data} loading={milestones.status === "loading"} onAdd={() => setDialog("milestone")} onChanged={reloadAll} />
            <Semesters data={semesters.data} loading={semesters.status === "loading"} onAdd={() => setDialog("semester")} onChanged={reloadAll} />
          </div>
        </>
      )}

      <LogSessionDialog open={dialog === "session"} onOpenChange={close} onSaved={reloadAll} subjects={subjects} />
      <SubjectDialog open={dialog === "subject"} onOpenChange={close} onSaved={reloadAll} />
      <AssignmentDialog open={dialog === "assignment"} onOpenChange={close} onSaved={reloadAll} subjects={subjects} />
      <MilestoneDialog open={dialog === "milestone"} onOpenChange={close} onSaved={reloadAll} subjects={subjects} />
      <SemesterDialog open={dialog === "semester"} onOpenChange={close} onSaved={reloadAll} existing={semesters.data?.semesters ?? []} />
      <ProblemDialog open={dialog === "problem"} onOpenChange={close} onSaved={reloadAll} />
    </div>
  );
}
