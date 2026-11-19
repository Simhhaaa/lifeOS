"use client";

import { useState, type FormEvent } from "react";
import { Checkbox } from "radix-ui";
import { Check, ListTodo, Plus, RotateCw, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ApiError, api } from "@/lib/api/client";
import type { Priority, Task } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { addDaysIso, todayIso } from "@/lib/local-date";
import { LivePanel, Notice } from "./live-panel";

const GROUPS = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "later", label: "Later this week" },
] as const;

/** Productivity → Plan, backed by /tasks (create, tick, delete) with versions and conflict handling. */
export function LiveTasks({ className }: { className?: string }) {
  const [today] = useState(todayIso);
  const tomorrow = addDaysIso(today, 1);
  const tasks = useResource<Task[]>("/tasks", { from: today, to: addDaysIso(today, 6) });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "neutral" | "coral"; text: string } | null>(null);

  const group = (t: Task) => (t.planned_for === today ? "today" : t.planned_for === tomorrow ? "tomorrow" : "later");

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.code === "version_conflict") setNotice({ tone: "neutral", text: "This task changed on another device. Showing the latest version." });
      else if (err?.code === "gone") setNotice({ tone: "neutral", text: "This task was deleted on another device." });
      else setNotice({ tone: "coral", text: err?.problem.detail ?? err?.message ?? "Something went wrong. Nothing was saved." });
      await tasks.reload();
    } finally {
      setBusy(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await run("new", async () => {
      const created = await api<Task>("/tasks", { method: "POST", body: { title: t, priority, planned_for: today } });
      tasks.mutate((xs) => [...xs, created]);
      setTitle("");
      setPriority("normal");
    });
  }

  const toggle = (t: Task) =>
    run(t.id, async () => {
      const updated = await api<Task>(`/tasks/${t.id}`, {
        method: "PATCH",
        version: t.version,
        body: { completed_at: t.completed_at ? null : new Date().toISOString() },
      });
      tasks.mutate((xs) => xs.map((x) => (x.id === t.id ? updated : x)));
    });

  const remove = (t: Task) =>
    run(t.id, async () => {
      await api(`/tasks/${t.id}`, { method: "DELETE", version: t.version });
      tasks.mutate((xs) => xs.filter((x) => x.id !== t.id));
    });

  return (
    <LivePanel
      title="Plan"
      subtitle="Your tasks for the next 7 days · tick, add or remove"
      className={className}
      actions={
        <button
          type="button"
          onClick={() => void tasks.reload()}
          aria-label="Refresh tasks"
          className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink-2"
        >
          <RotateCw size={14} aria-hidden />
        </button>
      }
    >
      <form onSubmit={add} className="mb-4 flex items-center gap-2">
        <label htmlFor="new-task" className="sr-only">
          New task for today
        </label>
        <input
          id="new-task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Add a task for today…"
          className="h-10 min-w-0 flex-1 rounded-ctl border border-edge-strong bg-base px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-saffron-line"
        />
        <button
          type="button"
          onClick={() => setPriority((p) => (p === "high" ? "normal" : "high"))}
          aria-pressed={priority === "high"}
          className={cn("h-10 rounded-ctl px-3 text-xs", priority === "high" ? "bg-saffron-soft text-saffron" : "bg-well text-ink-3")}
        >
          High
        </button>
        <button
          type="submit"
          disabled={!title.trim() || busy === "new"}
          aria-label="Add task"
          className="grid h-10 w-10 place-items-center rounded-ctl bg-saffron text-saffron-ink disabled:opacity-40"
        >
          <Plus size={17} strokeWidth={2.5} aria-hidden />
        </button>
      </form>

      {notice && (
        <div className="mb-3">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      )}

      {tasks.status === "loading" ? (
        <SkeletonRows rows={5} />
      ) : tasks.status === "error" && !tasks.data ? (
        <ErrorState what="tasks" onRetry={() => void tasks.reload()} />
      ) : !tasks.data?.length ? (
        <EmptyState icon={ListTodo} title="Nothing planned this week" description="Add 3–5 items for today above, so consistency can be measured against your plan." />
      ) : (
        <div className="flex flex-col gap-4">
          {GROUPS.map((g) => {
            const items = (tasks.data ?? []).filter((t) => group(t) === g.key);
            if (!items.length) return null;
            return (
              <section key={g.key} aria-label={g.label}>
                <p className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-ink-2">{g.label}</span>
                  <span className="num text-ink-3">
                    {items.filter((t) => t.completed_at).length}/{items.length}
                  </span>
                </p>
                <ul className="-mx-2 flex flex-col">
                  {items.map((t) => (
                    <li key={t.id} className="group flex min-h-11 items-center gap-3 rounded-box px-2 py-1.5 transition hover:bg-well/60">
                      <Checkbox.Root
                        checked={Boolean(t.completed_at)}
                        disabled={busy === t.id}
                        onCheckedChange={() => void toggle(t)}
                        aria-label={`Mark “${t.title}” ${t.completed_at ? "not done" : "done"}`}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] border-edge-strong transition disabled:opacity-50 data-[state=checked]:border-mint data-[state=checked]:bg-mint"
                      >
                        <Checkbox.Indicator>
                          <Check size={12} strokeWidth={3} className="text-base" />
                        </Checkbox.Indicator>
                      </Checkbox.Root>
                      <span className={cn("min-w-0 flex-1 truncate text-sm", t.completed_at ? "text-ink-3 line-through" : "text-ink")}>{t.title}</span>
                      {t.priority === "high" && !t.completed_at && <Chip tone="saffron">High</Chip>}
                      <button
                        type="button"
                        onClick={() => void remove(t)}
                        disabled={busy === t.id}
                        aria-label={`Delete “${t.title}”`}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 opacity-0 transition group-hover:opacity-100 hover:bg-well-strong hover:text-ink focus-visible:opacity-100"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </LivePanel>
  );
}
