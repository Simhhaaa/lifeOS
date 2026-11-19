"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Field, FormDialog, Select, TextInput } from "@/components/ui/form";
import { localIso, nowTime, useSubmit } from "@/components/live/submit";
import { api } from "@/lib/api/client";
import type { Exercise, MuscleGroup, TrackedLift, TrainingPlan, WorkoutTemplate } from "@/lib/api/types";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { todayIso } from "@/lib/local-date";

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  full_body: "Full body",
};
export const LIFT_LABEL: Record<TrackedLift, string> = { bench: "Bench press", squat: "Back squat", deadlift: "Deadlift", ohp: "Overhead press" };

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

const small = "h-9 px-2 text-xs";

/* ───────────── Log workout ───────────── */

type Row = { key: number; exercise_id: string; load: string; reps: string; rpe: string; warmup: boolean };
let rowKey = 0;
const newRow = (r: Partial<Row> = {}): Row => ({ key: ++rowKey, exercise_id: "", load: "", reps: "", rpe: "", warmup: false, ...r });

function rowsFor(t: WorkoutTemplate | undefined): Row[] {
  if (!t?.exercises.length) return [newRow()];
  return t.exercises.flatMap((x) => Array.from({ length: x.target_sets ?? 1 }, () => newRow({ exercise_id: x.exercise_id, reps: x.target_reps ? String(x.target_reps) : "" })));
}

export function LogWorkoutDialog({
  open,
  onOpenChange,
  onSaved,
  exercises,
  templates,
  suggested,
}: DialogProps & { exercises: Exercise[]; templates: WorkoutTemplate[]; suggested: string | null }) {
  const initial = templates.find((t) => t.name === suggested);
  const [templateId, setTemplateId] = useState(initial?.id ?? "");
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState(nowTime);
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>(() => rowsFor(initial));
  const { busy, error, run, setError } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setRows([newRow()]);
    setNote("");
  });
  const patch = (key: number, r: Partial<Row>) => setRows((rs) => rs.map((x) => (x.key === key ? { ...x, ...r } : x)));

  const submit = () => {
    const filled = rows.filter((r) => r.exercise_id && r.reps);
    if (!filled.length) return setError("Add at least one set with an exercise and reps.");
    if (filled.some((r) => r.load === "")) return setError("Every set needs a load in kg (0 for bodyweight).");
    return run(() => {
      const end = new Date(localIso(date, time));
      const start = new Date(end.getTime() - minutes * 60_000);
      return api("/workouts", {
        method: "POST",
        body: {
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          ...(templateId ? { template_id: templateId } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          sets: filled.map((r, i) => ({
            exercise_id: r.exercise_id,
            position: i + 1,
            load_kg: Number(r.load),
            reps: Number(r.reps),
            is_warmup: r.warmup,
            ...(r.rpe ? { rpe: Number(r.rpe) } : {}),
          })),
        },
      });
    });
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Log workout" description="Sets, reps and load · est. 1RM and PRs are worked out by the server" submitLabel="Save workout" busy={busy} error={error} onSubmit={submit}>
      {!exercises.length ? (
        <p className="rounded-ctl bg-well px-3 py-2 text-xs text-ink-2">Add exercises to your library first (Exercise library → Exercise).</p>
      ) : (
        <>
          <Field label="Split" hint="optional · fills in its exercises">
            <Select
              aria-label="Split"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setRows(rowsFor(templates.find((t) => t.id === e.target.value)));
              }}
            >
              <option value="">No split</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.name === suggested ? " · next in rotation" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <TextInput type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Ended at">
              <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </Field>
            <Field label="Minutes">
              <TextInput type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} required />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_64px_52px_52px_28px_28px] gap-1.5 text-[10px] text-ink-3">
              <span>Exercise</span>
              <span>kg</span>
              <span>Reps</span>
              <span>RPE</span>
              <span title="Warm-up">W</span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-[1fr_64px_52px_52px_28px_28px] items-center gap-1.5">
                <Select aria-label={`Set ${i + 1} exercise`} className={small} value={r.exercise_id} onChange={(e) => patch(r.key, { exercise_id: e.target.value })}>
                  <option value="">Choose…</option>
                  {exercises.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
                <TextInput aria-label={`Set ${i + 1} kg`} className={small} type="number" min={0} max={600} step="0.25" value={r.load} onChange={(e) => patch(r.key, { load: e.target.value })} />
                <TextInput aria-label={`Set ${i + 1} reps`} className={small} type="number" min={1} max={100} value={r.reps} onChange={(e) => patch(r.key, { reps: e.target.value })} />
                <TextInput aria-label={`Set ${i + 1} RPE`} className={small} type="number" min={5} max={10} step="0.5" value={r.rpe} placeholder="—" onChange={(e) => patch(r.key, { rpe: e.target.value })} />
                <input aria-label={`Set ${i + 1} is a warm-up`} type="checkbox" checked={r.warmup} onChange={(e) => patch(r.key, { warmup: e.target.checked })} className="h-4 w-4 accent-[var(--saffron)]" />
                <button type="button" aria-label={`Remove set ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, newRow({ exercise_id: rs.at(-1)?.exercise_id ?? "", load: rs.at(-1)?.load ?? "", reps: rs.at(-1)?.reps ?? "" })])}
              className="flex h-9 w-fit items-center gap-1.5 rounded-full bg-well px-3 text-xs text-ink-2 hover:text-ink"
            >
              <Plus size={13} /> Add set
            </button>
            <p className="text-2xs text-ink-3">Warm-up sets (W) don’t count toward volume or est. 1RM.</p>
          </div>
          <Field label="Note" hint="optional">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/* ───────────── Exercise ───────────── */

export function ExerciseDialog({ open, onOpenChange, onSaved, existing }: DialogProps & { existing?: Exercise }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [muscle, setMuscle] = useState<MuscleGroup>(existing?.muscle_group ?? "chest");
  const [equipment, setEquipment] = useState(existing?.equipment ?? "");
  const [lift, setLift] = useState<TrackedLift | "">(existing?.tracked_lift ?? "");
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    if (!existing) {
      setName("");
      setEquipment("");
      setLift("");
    }
  });
  const body = { name: name.trim(), muscle_group: muscle, equipment: equipment.trim() || null, tracked_lift: lift || null };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Edit exercise" : "Add exercise"}
      submitLabel={existing ? "Save" : "Add exercise"}
      busy={busy}
      error={error}
      onSubmit={() => run(() => (existing ? api(`/exercises/${existing.id}`, { method: "PATCH", version: existing.version, body }) : api("/exercises", { method: "POST", body })))}
    >
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="Incline dumbbell press" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Muscle group">
          <Select aria-label="Muscle group" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)}>
            {(Object.keys(MUSCLE_LABEL) as MuscleGroup[]).map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Equipment" hint="optional">
          <TextInput value={equipment} onChange={(e) => setEquipment(e.target.value)} maxLength={40} placeholder="Barbell" />
        </Field>
      </div>
      <Field label="Tracked lift" hint="charts est. 1RM and PRs">
        <Select aria-label="Tracked lift" value={lift} onChange={(e) => setLift(e.target.value as TrackedLift | "")}>
          <option value="">Not tracked</option>
          {(Object.keys(LIFT_LABEL) as TrackedLift[]).map((l) => (
            <option key={l} value={l}>
              {LIFT_LABEL[l]}
            </option>
          ))}
        </Select>
      </Field>
    </FormDialog>
  );
}

/* ───────────── Split (workout template) ───────────── */

export function SplitDialog({ open, onOpenChange, onSaved, exercises, existing }: DialogProps & { exercises: Exercise[]; existing?: WorkoutTemplate }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [chosen, setChosen] = useState<{ id: string; sets: string }[]>(existing?.exercises.map((x) => ({ id: x.exercise_id, sets: String(x.target_sets ?? 3) })) ?? []);
  const { busy, error, run } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    if (!existing) {
      setName("");
      setChosen([]);
    }
  });
  const toggle = (id: string) => setChosen((c) => (c.some((x) => x.id === id) ? c.filter((x) => x.id !== id) : [...c, { id, sets: "3" }]));
  const body = { name: name.trim(), exercises: chosen.map((x) => ({ exercise_id: x.id, target_sets: Number(x.sets) || null })) };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? `Edit ${existing.name}` : "Add split"}
      description="A named session, e.g. Push, Pull or Legs, with its exercises in order"
      submitLabel={existing ? "Save split" : "Add split"}
      busy={busy}
      error={error}
      onSubmit={() => run(() => (existing ? api(`/workout-templates/${existing.id}`, { method: "PATCH", version: existing.version, body }) : api("/workout-templates", { method: "POST", body })))}
    >
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Push" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-2">Exercises · in the order you tick them</p>
        {!exercises.length && <p className="text-2xs text-ink-3">Your exercise library is empty.</p>}
        <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {exercises.map((x) => {
            const at = chosen.findIndex((c) => c.id === x.id);
            return (
              <li key={x.id} className="flex items-center gap-2 rounded-ctl px-1.5 py-1 hover:bg-well">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" checked={at >= 0} onChange={() => toggle(x.id)} className="h-4 w-4 accent-[var(--saffron)]" />
                  {x.name}
                  {at >= 0 && <span className="num text-2xs text-saffron">#{at + 1}</span>}
                </label>
                {at >= 0 && (
                  <TextInput
                    aria-label={`${x.name} target sets`}
                    className="h-7 w-14 px-2 text-xs"
                    type="number"
                    min={1}
                    max={20}
                    value={chosen[at].sets}
                    onChange={(e) => setChosen((c) => c.map((y) => (y.id === x.id ? { ...y, sets: e.target.value } : y)))}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </FormDialog>
  );
}

/* ───────────── Training plan ───────────── */

export function PlanDialog({ open, onOpenChange, onSaved, templates, plan }: DialogProps & { templates: WorkoutTemplate[]; plan: TrainingPlan | null }) {
  const [days, setDays] = useState<number[]>(plan?.weekdays ?? []);
  const [rotation, setRotation] = useState<string[]>(plan?.rotation ?? []);
  const { busy, error, run, setError } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
  });
  const name = Object.fromEntries(templates.map((t) => [t.id, t.name]));
  const move = (i: number, d: number) =>
    setRotation((r) => {
      const n = [...r];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const submit = () => {
    if (!rotation.length) return setError("Add at least one split to the rotation.");
    return run(() => api("/training-plan", { method: "PUT", ...(plan ? { version: plan.version } : {}), body: { weekdays: days, rotation } }));
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Training plan" description="Training days and the order your splits rotate in" submitLabel="Save plan" busy={busy} error={error} onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-2">Training days</p>
        <div className="flex gap-1.5" role="group" aria-label="Training days">
          {WEEKDAY_SHORT.map((d, i) => {
            const on = days.includes(i + 1);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((ds) => (on ? ds.filter((x) => x !== i + 1) : [...ds, i + 1].sort()))}
                className={cn("h-9 flex-1 rounded-full text-xs transition", on ? "bg-ink text-base" : "bg-well text-ink-2 hover:text-ink")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-2">Rotation</p>
        {!templates.length ? (
          <p className="text-2xs text-ink-3">Add a split first (This week → Split).</p>
        ) : (
          <>
            <ol className="flex flex-col gap-1">
              {rotation.map((id, i) => (
                <li key={`${id}-${i}`} className="flex items-center gap-2 rounded-ctl bg-well px-2.5 py-1.5 text-sm text-ink">
                  <span className="num w-4 text-2xs text-ink-3">{i + 1}</span>
                  <span className="flex-1">{name[id] ?? "Removed split"}</span>
                  <button type="button" aria-label={`Move ${name[id]} up`} disabled={i === 0} onClick={() => move(i, -1)} className="text-ink-3 hover:text-ink disabled:opacity-30">
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" aria-label={`Move ${name[id]} down`} disabled={i === rotation.length - 1} onClick={() => move(i, 1)} className="text-ink-3 hover:text-ink disabled:opacity-30">
                    <ArrowDown size={13} />
                  </button>
                  <button type="button" aria-label={`Remove ${name[id]} from rotation`} onClick={() => setRotation((r) => r.filter((_, k) => k !== i))} className="text-ink-3 hover:text-ink">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ol>
            <Select aria-label="Add to rotation" value="" onChange={(e) => e.target.value && setRotation((r) => (r.length < 7 ? [...r, e.target.value] : r))}>
              <option value="">Add a split to the rotation…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>
    </FormDialog>
  );
}

/* ───────────── Body measurement ───────────── */

export function BodyDialog({ open, onOpenChange, onSaved }: DialogProps) {
  const [date, setDate] = useState(todayIso);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const { busy, error, run, setError } = useSubmit(() => {
    onSaved();
    onOpenChange(false);
    setWeight("");
    setWaist("");
  });
  const submit = () => {
    if (!weight && !waist) return setError("Enter bodyweight, waist or both.");
    return run(() =>
      api("/body-measurements", {
        method: "POST",
        body: { measured_on: date, ...(weight ? { weight_kg: Number(weight) } : {}), ...(waist ? { waist_cm: Number(waist) } : {}) },
      }),
    );
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Log measurement" description="kg and cm" submitLabel="Save measurement" busy={busy} error={error} onSubmit={submit}>
      <Field label="Date">
        <TextInput type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bodyweight" hint="kg">
          <TextInput type="number" min={20} max={400} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <Field label="Waist" hint="cm">
          <TextInput type="number" min={30} max={250} step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}
