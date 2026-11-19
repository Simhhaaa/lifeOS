"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "radix-ui";
import { Moon, PencilLine, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { Pips } from "@/components/ui/progress";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { MethodInfo } from "@/components/ui/info";
import { ApiError, api } from "@/lib/api/client";
import type { DailyLog, DailyLogInput } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { todayIso } from "@/lib/local-date";
import { SLEEP_TARGET_H, scalePoints, sleepPoints } from "@/lib/progression";
import { LivePanel, Notice } from "./live-panel";

const fmtH = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

type Fields = Required<DailyLogInput>;
const SCALES: { key: keyof Fields; label: string; low: string; high: string; optional?: boolean }[] = [
  { key: "sleep_quality", label: "Sleep quality", low: "Poor", high: "Great", optional: true },
  { key: "energy", label: "Energy", low: "Drained", high: "Full" },
  { key: "recovery", label: "Recovery", low: "Sore", high: "Fresh" },
  { key: "mood", label: "Mood", low: "Low", high: "Great", optional: true },
];

function Scale({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number | null) => void; low: string; high: string }) {
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={cn("num h-10 rounded-ctl text-sm transition", value === v ? "bg-ink text-base" : "bg-well text-ink-2 hover:bg-well-strong")}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-2xs text-ink-3">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </div>
  );
}

function CheckInDialog({
  open,
  onOpenChange,
  date,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  existing: DailyLog | null;
  onSaved: (log: DailyLog) => void;
}) {
  const init = (): Fields => ({
    sleep_hours: existing?.sleep_hours ?? 7.5,
    sleep_quality: existing?.sleep_quality ?? null,
    energy: existing?.energy ?? null,
    recovery: existing?.recovery ?? null,
    mood: existing?.mood ?? null,
  });
  const [f, setF] = useState<Fields>(init);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<DailyLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(version: number | undefined) {
    setBusy(true);
    setError(null);
    try {
      const log = await api<DailyLog>(`/daily-logs/${date}`, { method: "PUT", body: f, version });
      setConflict(null);
      onSaved(log);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "version_conflict" && e.problem.current) setConflict(e.problem.current as unknown as DailyLog);
      else setError(e instanceof ApiError ? (e.problem.errors?.[0]?.message ?? e.message) : "Couldn’t save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(existing?.version);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setF(init());
          setConflict(null);
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-slab border border-edge-strong bg-slab p-6 shadow-2xl shadow-black/70 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">Daily check-in</Dialog.Title>
              <Dialog.Description className="text-xs text-ink-3">Today · sleep, energy and recovery set readiness</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
              <X size={16} />
            </Dialog.Close>
          </div>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
            <div>
              <p className="mb-2 flex justify-between text-xs text-ink-2">
                Sleep last night <span className="text-ink-3">target {SLEEP_TARGET_H} h</span>
              </p>
              <div className="flex items-center gap-2" role="group" aria-label="Sleep hours">
                <button type="button" aria-label="Less sleep" onClick={() => setF((x) => ({ ...x, sleep_hours: Math.max(0, (x.sleep_hours ?? 0) - 0.25) }))} className="grid h-10 w-10 place-items-center rounded-full bg-well text-lg text-ink">
                  −
                </button>
                <output aria-live="polite" className="num flex-1 text-center text-xl text-ink">
                  {f.sleep_hours === null ? "—" : fmtH(f.sleep_hours)}
                </output>
                <button type="button" aria-label="More sleep" onClick={() => setF((x) => ({ ...x, sleep_hours: Math.min(16, (x.sleep_hours ?? 0) + 0.25) }))} className="grid h-10 w-10 place-items-center rounded-full bg-well text-lg text-ink">
                  +
                </button>
              </div>
            </div>
            {SCALES.map((s) => (
              <div key={s.key}>
                <p className="mb-2 flex justify-between text-xs text-ink-2">
                  {s.label} {s.optional && <span className="text-ink-3">optional</span>}
                </p>
                <Scale label={s.label} value={f[s.key]} onChange={(v) => setF((x) => ({ ...x, [s.key]: v }))} low={s.low} high={s.high} />
              </div>
            ))}
            {conflict && (
              <div className="flex flex-col gap-2 rounded-box border border-saffron-line bg-saffron-soft p-3">
                <p className="text-xs text-ink">
                  This check-in was changed on another device. Server values: sleep {conflict.sleep_hours ?? "—"} h, energy {conflict.energy ?? "—"}, recovery {conflict.recovery ?? "—"}.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" type="button" onClick={() => { onSaved(conflict); onOpenChange(false); }}>
                    Keep server’s
                  </Button>
                  <Button size="sm" variant="primary" type="button" onClick={() => void save(conflict.version)} disabled={busy}>
                    Keep mine
                  </Button>
                </div>
              </div>
            )}
            {error && <Notice tone="coral">{error}</Notice>}
            <Button type="submit" variant="primary" className="h-11 w-full justify-center" disabled={busy}>
              {busy ? "Saving…" : "Save check-in"}
            </Button>
            <p className="text-center text-2xs text-ink-3">A planning aid, not medical advice.</p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Health → Readiness, backed by GET/PUT /daily-logs/{today}. */
export function LiveCheckIn({ className }: { className?: string }) {
  const [today] = useState(todayIso);
  const log = useResource<DailyLog>(`/daily-logs/${today}`);
  const [open, setOpen] = useState(false);
  const missing = log.status === "error" && log.error.code === "not_found";
  const current = log.status === "ready" ? log.data : null;
  const r = current?.readiness.result;

  return (
    <LivePanel
      title="Readiness"
      subtitle="Today’s check-in"
      className={className}
      actions={
        <MethodInfo label="readiness">
          Sleep ≥ {SLEEP_TARGET_H} h = 2 points, ≥ {SLEEP_TARGET_H - 1} h = 1. Energy and recovery (1–5): 4+ = 2, 3 = 1. Total 5–6 High, 3–4 Moderate, 0–2 Low. Needs all three. Calculated by the server.
        </MethodInfo>
      }
    >
      {log.status === "loading" ? (
        <SkeletonRows rows={3} />
      ) : missing ? (
        <EmptyState
          icon={Moon}
          title="No check-in today"
          description="Log sleep, energy and recovery to see today’s readiness."
          action={
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              Daily check-in
            </Button>
          }
        />
      ) : log.status === "error" ? (
        <ErrorState what="today’s check-in" onRetry={() => void log.reload()} />
      ) : current ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-baseline gap-2">
            <span className={cn("font-display text-[30px] leading-8 font-semibold tracking-[-0.03em]", r?.level === "High" ? "text-mint" : r?.level === "Low" ? "text-coral" : "text-ink")}>
              {r?.level ?? "Incomplete"}
            </span>
            {r ? <span className="num text-xs text-ink-3">{r.points} of 6 points</span> : <span className="text-xs text-ink-3">add the missing inputs</span>}
          </p>
          <ul className="flex flex-col gap-2 text-xs">
            {[
              { label: "Sleep", value: current.sleep_hours === null ? "—" : fmtH(current.sleep_hours), pts: current.sleep_hours === null ? null : sleepPoints(current.sleep_hours) },
              { label: "Energy", value: `${current.energy ?? "—"}/5`, pts: current.energy === null ? null : scalePoints(current.energy) },
              { label: "Recovery", value: `${current.recovery ?? "—"}/5`, pts: current.recovery === null ? null : scalePoints(current.recovery) },
            ].map((i) => (
              <li key={i.label} className="flex items-center gap-3">
                <span className="w-16 text-ink-3">{i.label}</span>
                <span className="num flex-1 text-ink">{i.value}</span>
                {i.pts !== null && <Pips current={i.pts} target={2} size="sm" label={`${i.label}: ${i.pts} of 2 points`} />}
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
            <PencilLine size={13} aria-hidden /> Edit check-in
          </Button>
        </div>
      ) : null}
      <CheckInDialog
        open={open}
        onOpenChange={setOpen}
        date={today}
        existing={current}
        onSaved={() => void log.reload()}
      />
    </LivePanel>
  );
}
