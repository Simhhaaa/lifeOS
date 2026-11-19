"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Field, FormDialog, Segmented, Select, TextInput } from "@/components/ui/form";
import { api } from "@/lib/api/client";
import { errorText, localIso, nowTime, useSubmit } from "@/components/live/submit";

export { errorText };
import type { Assignment, Milestone, Semester, Subject } from "@/lib/api/types";
import { todayIso } from "@/lib/local-date";

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

/* ───────────── Log study / coding session ───────────── */

type Problem = { difficulty: "easy" | "medium" | "hard"; topic: string; url: string };

export function LogSessionDialog({ open, onOpenChange, onSaved, subjects }: DialogProps & { subjects: Subject[] }) {
  const [kind, setKind] = useState<"study" | "coding">("study");
  const [subjectId, setSubjectId] = useState("");
  const [area, setArea] = useState<"dsa" | "project" | "course" | "other">("dsa");
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState(nowTime);
  const [minutes, setMinutes] = useState(60);
  const [focus, setFocus] = useState(4);
  const [problems, setProblems] = useState<Problem[]>([]);
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setProblems([]);
  });

  const submit = () =>
    run(async () => {
      // The time entered is when the session ENDED (what people remember); started_at = end − duration.
      const end = new Date(localIso(date, time));
      const started_at = new Date(end.getTime() - minutes * 60_000).toISOString();
      if (kind === "study") {
        await api("/study/sessions", {
          method: "POST",
          body: { started_at, minutes, focus_rating: focus, ...(subjectId ? { subject_id: subjectId } : {}) },
        });
      } else {
        await api("/coding/sessions", {
          method: "POST",
          body: {
            area,
            started_at,
            minutes,
            focus_rating: focus,
            problems: problems
              .filter((p) => p.topic.trim())
              .map((p) => ({ difficulty: p.difficulty, topic: p.topic.trim(), solved_at: end.toISOString(), ...(p.url.trim() ? { url: p.url.trim() } : {}) })),
          },
        });
      }
    });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log session"
      description="Focused time only · XP is awarded by the server later"
      submitLabel="Save session"
      busy={busy}
      error={error}
      onSubmit={submit}
    >
      <Segmented label="Session type" value={kind} onChange={setKind} options={[{ value: "study", label: "Study" }, { value: "coding", label: "Coding" }]} />
      {kind === "study" ? (
        <Field label="Subject" hint="optional">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
            <option value="">No subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short_name} · {s.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Area">
          <Segmented
            label="Area"
            value={area}
            onChange={setArea}
            options={[
              { value: "dsa", label: "DSA" },
              { value: "project", label: "Project" },
              { value: "course", label: "Course lab" },
              { value: "other", label: "Other" },
            ]}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <TextInput type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Ended at">
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Focused minutes">
          <TextInput type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} required />
        </Field>
        <Field label="Focus (1–5)">
          <TextInput type="number" min={1} max={5} value={focus} onChange={(e) => setFocus(Number(e.target.value))} />
        </Field>
      </div>
      {kind === "coding" && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center justify-between text-xs text-ink-2">
            Problems solved <span className="text-ink-3">outcome evidence for DSA</span>
          </p>
          {problems.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                aria-label="Difficulty"
                className="w-28"
                value={p.difficulty}
                onChange={(e) => setProblems((ps) => ps.map((x, k) => (k === i ? { ...x, difficulty: e.target.value as Problem["difficulty"] } : x)))}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
              <TextInput
                aria-label="Topic"
                placeholder="Topic, e.g. Graphs"
                value={p.topic}
                onChange={(e) => setProblems((ps) => ps.map((x, k) => (k === i ? { ...x, topic: e.target.value } : x)))}
              />
              <button type="button" aria-label="Remove problem" onClick={() => setProblems((ps) => ps.filter((_, k) => k !== i))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setProblems((ps) => [...ps, { difficulty: "medium", topic: "", url: "" }])}
            className="flex h-9 w-fit items-center gap-1.5 rounded-full bg-well px-3 text-xs text-ink-2 hover:text-ink"
          >
            <Plus size={13} /> Add problem
          </button>
        </div>
      )}
    </FormDialog>
  );
}

/* ───────────── Subject ───────────── */

export function SubjectDialog({ open, onOpenChange, onSaved }: DialogProps) {
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [credits, setCredits] = useState("");
  const [units, setUnits] = useState("10");
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setName("");
    setShort("");
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add subject"
      submitLabel="Add subject"
      busy={busy}
      error={error}
      onSubmit={() =>
        run(() =>
          api("/subjects", {
            method: "POST",
            body: { name: name.trim(), short_name: short.trim(), units_total: Number(units) || 0, ...(credits ? { credits: Number(credits) } : {}) },
          }),
        )
      }
    >
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="Database Management Systems" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Short name">
          <TextInput value={short} onChange={(e) => setShort(e.target.value)} maxLength={12} required placeholder="DBMS" />
        </Field>
        <Field label="Credits">
          <TextInput type="number" min={0} max={30} value={credits} onChange={(e) => setCredits(e.target.value)} />
        </Field>
        <Field label="Syllabus units">
          <TextInput type="number" min={0} max={100} value={units} onChange={(e) => setUnits(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}

/* ───────────── Assignment ───────────── */

export function AssignmentDialog({ open, onOpenChange, onSaved, subjects }: DialogProps & { subjects: Subject[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState("23:59");
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setTitle("");
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add assignment"
      submitLabel="Add assignment"
      busy={busy}
      error={error}
      onSubmit={() =>
        run(() => api("/assignments", { method: "POST", body: { subject_id: subjectId || subjects[0]?.id, title: title.trim(), due_at: localIso(date, time) } }))
      }
    >
      <Field label="Subject">
        <Select value={subjectId || subjects[0]?.id || ""} onChange={(e) => setSubjectId(e.target.value)} required aria-label="Subject">
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.short_name} · {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder="OS assignment 3" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Due time">
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
    </FormDialog>
  );
}

/** Full-body PATCH for an assignment (the contract replaces all fields), e.g. a status change. */
export async function updateAssignment(a: Assignment, changes: Partial<Pick<Assignment, "status" | "grade_score" | "grade_max">>) {
  const body = { subject_id: a.subject_id, title: a.title, due_at: a.due_at, status: a.status, grade_score: a.grade_score, grade_max: a.grade_max, ...changes };
  return api<Assignment>(`/assignments/${a.id}`, { method: "PATCH", version: a.version, body });
}

/* ───────────── Milestone ───────────── */

export function MilestoneDialog({ open, onOpenChange, onSaved, subjects }: DialogProps & { subjects: Subject[] }) {
  const [kind, setKind] = useState<Milestone["kind"]>("learning");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [project, setProject] = useState("");
  const [planned, setPlanned] = useState("");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("");
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setTitle("");
    setScore("");
    setMax("");
  });
  const submit = () =>
    run(() =>
      api("/milestones", {
        method: "POST",
        body: {
          kind,
          title: title.trim(),
          ...(kind === "project" ? { project: project.trim() } : subjectId ? { subject_id: subjectId } : {}),
          ...(planned ? { planned_for: planned } : {}),
          ...(kind === "assessment" && score && max ? { score: Number(score), max_score: Number(max), completed_at: new Date().toISOString() } : {}),
        },
      }),
    );
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add milestone" description="Outcome evidence for Learning and projects" submitLabel="Add milestone" busy={busy} error={error} onSubmit={submit}>
      <Segmented
        label="Kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: "learning", label: "Learning" },
          { value: "assessment", label: "Assessment" },
          { value: "project", label: "Project" },
        ]}
      />
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder={kind === "assessment" ? "DBMS mid-semester exam" : "Unit 8 · Transactions"} />
      </Field>
      {kind === "project" ? (
        <Field label="Project">
          <TextInput value={project} onChange={(e) => setProject(e.target.value)} maxLength={120} required placeholder="LifeOS" />
        </Field>
      ) : (
        <Field label="Subject" hint="optional">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
            <option value="">No subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short_name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {kind === "assessment" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Score" hint="leave empty if not taken yet">
            <TextInput type="number" min={0} step="any" value={score} onChange={(e) => setScore(e.target.value)} />
          </Field>
          <Field label="Out of">
            <TextInput type="number" min={0} step="any" value={max} onChange={(e) => setMax(e.target.value)} />
          </Field>
        </div>
      ) : null}
      <Field label="Planned for" hint="optional">
        <TextInput type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

/* ───────────── Semester ───────────── */

export function SemesterDialog({ open, onOpenChange, onSaved, existing }: DialogProps & { existing: Semester[] }) {
  const nextOrdinal = Math.max(0, ...existing.map((s) => s.ordinal)) + 1;
  const [credits, setCredits] = useState("");
  const [sgpa, setSgpa] = useState("");
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setCredits("");
    setSgpa("");
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add Sem ${nextOrdinal}`}
      description="Leave SGPA empty for the current semester"
      submitLabel="Add semester"
      busy={busy}
      error={error}
      onSubmit={() =>
        run(() =>
          api("/semesters", {
            method: "POST",
            body: { label: `Sem ${nextOrdinal}`, ordinal: nextOrdinal, ...(credits ? { credits: Number(credits) } : {}), ...(sgpa ? { sgpa: Number(sgpa) } : { is_current: true }) },
          }),
        )
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Credits">
          <TextInput type="number" min={0} max={60} value={credits} onChange={(e) => setCredits(e.target.value)} />
        </Field>
        <Field label="SGPA" hint="of 10">
          <TextInput type="number" min={0} max={10} step="0.01" value={sgpa} onChange={(e) => setSgpa(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}

/* ───────────── DSA problem ───────────── */

export function ProblemDialog({ open, onOpenChange, onSaved }: DialogProps) {
  const [difficulty, setDifficulty] = useState<Problem["difficulty"]>("medium");
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setTopic("");
    setUrl("");
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log solved problem"
      description="A problem URL can only be logged once"
      submitLabel="Log problem"
      busy={busy}
      error={error}
      onSubmit={() =>
        run(() =>
          api("/dsa/problems", { method: "POST", body: { difficulty, topic: topic.trim(), solved_at: new Date().toISOString(), ...(url.trim() ? { url: url.trim() } : {}) } }),
        )
      }
    >
      <Segmented
        label="Difficulty"
        value={difficulty}
        onChange={setDifficulty}
        options={[
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" },
        ]}
      />
      <Field label="Topic">
        <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} required placeholder="Graphs" />
      </Field>
      <Field label="Problem URL" hint="optional, prevents duplicates">
        <TextInput type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </Field>
    </FormDialog>
  );
}

