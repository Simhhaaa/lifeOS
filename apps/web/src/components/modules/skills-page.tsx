"use client";

import { useState } from "react";
import { ToggleGroup } from "radix-ui";
import { Gauge, History, Swords } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/chip";
import { FormBadge } from "@/components/ui/form-badge";
import { MethodInfo, Tooltip } from "@/components/ui/info";
import { Bar } from "@/components/ui/progress";
import { Module } from "@/components/dashboard/module";
import { PageHeader } from "@/components/page/page-header";
import { StatStrip } from "@/components/page/stat-strip";
import { DAY_MS, formatRelativeDay, formatShortDate, formatTime, startOfDay } from "@/lib/dates";
import { ATTRIBUTE_MIN_COVERAGE, SKILL_XP_SCALE, type AttributeResult } from "@/lib/progression";
import type { SkillDetail } from "@/lib/sample/skills";
import type { XpEvent } from "@/lib/types";

/* ───────────── Attributes, in full ───────────── */

function AttributeRow({ a }: { a: AttributeResult }) {
  return (
    <li className="grid gap-4 border-t border-edge py-5 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">{a.label}</h3>
          <span className="font-display text-[34px] leading-none font-semibold tracking-[-0.04em] text-ink">
            {a.score ?? <span className="text-base font-normal text-ink-3">—</span>}
          </span>
        </div>
        <div className="mt-3 flex h-2.5 w-full gap-[3px]" aria-hidden>
          {a.signals.map((s) => (
            <span
              key={s.key}
              className={cn(
                "relative h-full overflow-hidden rounded-full",
                s.score === null ? "hatch text-edge-strong ring-1 ring-edge-strong ring-inset" : "bg-well-strong",
              )}
              style={{ flexGrow: s.weight, flexBasis: 0 }}
            >
              {s.score !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-sky" style={{ width: `${s.score}%` }} />}
            </span>
          ))}
        </div>
        <p className="mt-2 text-2xs text-ink-3">
          {Math.round(a.coverage * 100)}% of the formula has data
          {a.score === null && ` · below ${Math.round(ATTRIBUTE_MIN_COVERAGE * 100)}%, no score`}
        </p>
      </div>
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Signals behind {a.label}</caption>
        <thead>
          <tr className="text-2xs text-ink-3">
            <th scope="col" className="pb-2 font-normal">Signal</th>
            <th scope="col" className="w-16 pb-2 text-right font-normal">Weight</th>
            <th scope="col" className="hidden w-40 pb-2 pl-5 font-normal sm:table-cell">Score vs target</th>
            <th scope="col" className="w-16 pb-2 text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          {a.signals.map((s) => (
            <tr key={s.key} className="border-t border-edge/70">
              <td className="py-2 pr-3 text-ink-2">{s.label}</td>
              <td className="num py-2 text-right text-ink-3">{Math.round(s.weight * 100)}%</td>
              <td className="hidden py-2 pl-5 sm:table-cell">
                {s.score === null ? (
                  <span className="hatch block h-1.5 w-full rounded-full text-edge-strong" aria-hidden />
                ) : (
                  <Bar value={s.score / 100} tone="sky" size="sm" label={`${s.label}: ${s.score}`} />
                )}
              </td>
              <td className="num py-2 text-right whitespace-nowrap text-ink">{s.score ?? <span className="text-ink-3">no data</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </li>
  );
}

function AttributesDetail() {
  return (
    <Module
      framed
      title="Attributes"
      subtitle="Current capability, 0–100 · each signal scored against your own target · can go down"
      className="xl:col-span-12"
      skeleton={{ rows: 5 }}
      actions={() => (
        <MethodInfo label="attributes">
          Attribute = Σ(weight × signal score) ÷ Σ(weights of signals with data). Each signal is scored
          min(100, value ÷ your target × 100). Signals without data are left out and the remaining weights
          re-normalised; coverage is the share of weight that had data. Below {Math.round(ATTRIBUTE_MIN_COVERAGE * 100)}%
          coverage no score is shown. Targets are placeholders until you set them in Settings.
        </MethodInfo>
      )}
      empty={{ icon: Gauge, title: "No attribute data yet", description: "Attributes appear once enough measured signals exist." }}
    >
      {(d) => (
        <ul className="flex flex-col">
          {d.attributes.map((a) => (
            <AttributeRow key={a.key} a={a} />
          ))}
        </ul>
      )}
    </Module>
  );
}

/* ───────────── Skills: table + detail ───────────── */

function SkillDetailPanel({ s }: { s: SkillDetail }) {
  const max = Math.max(1, ...s.weekly.map((w) => w.xp));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">Selected skill</p>
          <h3 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">{s.name}</h3>
        </div>
        <p className="text-right">
          <span className="text-xs text-ink-3">Lv </span>
          <span className="font-display text-[34px] leading-none font-semibold tracking-[-0.04em] text-ink">{s.progress.level}</span>
        </p>
      </div>
      <div>
        <Bar value={s.progress.ratio} label={`${s.name}: progress to level ${s.progress.level + 1}`} />
        <p className="num mt-1.5 flex justify-between text-2xs text-ink-3">
          <span>{s.xp.toLocaleString()} XP lifetime</span>
          <span>{s.progress.toNext.toLocaleString()} XP to Lv {s.progress.level + 1}</span>
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-box bg-well p-3">
          <p className="text-2xs text-ink-3">Activity XP</p>
          <p className="mt-0.5 text-xs text-ink-2">{s.activity}</p>
        </div>
        <div className="rounded-box bg-well p-3">
          <p className="text-2xs text-ink-3">Outcome evidence</p>
          <p className="mt-0.5 text-xs text-ink-2">{s.outcome}</p>
        </div>
      </div>
      <div>
        <p className="mb-1 flex items-center justify-between text-xs text-ink-2">
          Form
          {s.form ? <FormBadge form={s.form} metric={s.formMetric ?? ""} /> : <span className="text-2xs text-ink-3">No form metric defined yet</span>}
        </p>
        <p className="text-2xs text-ink-3">{s.formMetric ?? "Open question: which measured metric should drive this skill’s form."}</p>
      </div>
      <figure aria-label={`${s.name} XP per week, last 8 weeks`}>
        <p className="mb-2 flex justify-between text-xs text-ink-2">
          XP per week <span className="num text-2xs text-ink-3">{s.windowXp.toLocaleString()} XP in 8 weeks</span>
        </p>
        <div className="flex h-20 items-end gap-1.5">
          {s.weekly.map((w) => (
            <Tooltip key={w.weekStart.getTime()} content={`Week of ${formatShortDate(w.weekStart)} · ${w.xp} XP`}>
              <span
                tabIndex={0}
                className={cn("flex-1 rounded-t-[5px]", w.xp ? "bg-saffron/80" : "h-0.5 bg-edge-strong")}
                style={w.xp ? { height: `${(w.xp / max) * 100}%` } : undefined}
              />
            </Tooltip>
          ))}
        </div>
        <figcaption className="num mt-1 flex justify-between text-[10px] text-ink-3">
          <span>{formatShortDate(s.weekly[0].weekStart)}</span>
          <span>this week</span>
        </figcaption>
      </figure>
      <div>
        <p className="mb-2 text-xs text-ink-2">Where the XP came from · 8 weeks</p>
        {s.sources.length ? (
          <ul className="flex flex-col gap-1.5">
            {s.sources.map((src) => (
              <li key={src.reason} className="flex items-center gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate text-ink-2">{src.reason}</span>
                <span className="num text-2xs text-ink-3">×{src.count}</span>
                <span className="num w-14 text-right text-saffron">+{src.xp}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2xs text-ink-3">No awards in this window. All {s.xp.toLocaleString()} XP was earned earlier.</p>
        )}
      </div>
    </div>
  );
}

function SkillsTable() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Module
      framed
      title="All skills"
      subtitle={`Level from lifetime skill XP · curve 25·(L−1)^1.8 · select a skill for detail`}
      className="xl:col-span-12"
      skeleton={{ rows: 9 }}
      actions={() => (
        <MethodInfo label="skill levels">
          Reaching skill level L takes {SKILL_XP_SCALE} × (L − 1)^1.8 lifetime XP. Levels never go down. Form compares a
          measured metric over the last 14 days with the prior 28 days; skills without a defined metric show none.
          Logging more sessions alone never counts as skill improvement.
        </MethodInfo>
      )}
      empty={{ icon: Swords, title: "No skill XP yet", description: "Skills level up from validated activity and measured outcomes." }}
    >
      {(d) => {
        const skills = d.skillsDetail.skills;
        const current = skills.find((s) => s.key === sel) ?? skills[0];
        return (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Skills with level, XP and form</caption>
              <thead>
                <tr className="text-2xs text-ink-3">
                  <th scope="col" className="pb-2 font-normal">Skill</th>
                  <th scope="col" className="pb-2 font-normal">Level</th>
                  <th scope="col" className="hidden pb-2 text-right font-normal md:table-cell">XP</th>
                  <th scope="col" className="pb-2 pl-4 text-right font-normal">Form</th>
                  <th scope="col" className="hidden pb-2 pl-4 text-right font-normal sm:table-cell">Last award</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => {
                  const active = s.key === current.key;
                  return (
                    <tr
                      key={s.key}
                      onClick={() => setSel(s.key)}
                      className={cn("cursor-pointer border-t border-edge/70 transition", active ? "bg-well" : "hover:bg-well/50")}
                    >
                      <td className="py-2.5 pr-3 pl-2">
                        <button
                          type="button"
                          onClick={() => setSel(s.key)}
                          aria-pressed={active}
                          className={cn("text-left", active ? "font-medium text-ink" : "text-ink-2")}
                        >
                          {s.name}
                        </button>
                      </td>
                      <td className="w-40 py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="num w-6 text-ink">{s.progress.level}</span>
                          <Bar value={s.progress.ratio} size="sm" label={`${s.name}: progress to next level`} />
                        </div>
                      </td>
                      <td className="num hidden py-2.5 text-right text-ink-3 md:table-cell">{s.xp.toLocaleString()}</td>
                      <td className="py-2.5 pl-4 text-right">
                        {s.form ? <FormBadge form={s.form} metric={s.formMetric ?? ""} /> : <span className="text-2xs text-ink-3">No metric</span>}
                      </td>
                      <td className="num hidden py-2.5 pr-2 pl-4 text-right text-2xs text-ink-3 sm:table-cell">
                        {s.lastAward ? formatRelativeDay(s.lastAward, d.now) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="rounded-box border border-edge bg-base/40 p-4">
              <SkillDetailPanel s={current} />
            </div>
          </div>
        );
      }}
    </Module>
  );
}

/* ───────────── XP ledger ───────────── */

function Ledger({ events, now }: { events: XpEvent[]; now: Date }) {
  const skills = ["All", ...Array.from(new Set(events.map((e) => e.skill)))];
  const [skill, setSkill] = useState("All");
  const [dayLimit, setDayLimit] = useState(6);
  const list = events.filter((e) => skill === "All" || e.skill === skill);
  // Paginate by whole days so every day total is complete.
  const all: { key: number; label: string; items: XpEvent[] }[] = [];
  list.forEach((e) => {
    const key = startOfDay(e.at).getTime();
    let g = all.find((x) => x.key === key);
    if (!g) {
      const diff = Math.round((startOfDay(now).getTime() - key) / DAY_MS);
      g = { key, label: diff === 0 ? "Today" : diff === 1 ? "Yesterday" : formatShortDate(e.at), items: [] };
      all.push(g);
    }
    g.items.push(e);
  });
  const groups = all.slice(0, dayLimit);
  const shownCount = groups.reduce((a, g) => a + g.items.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup.Root
        type="single"
        value={skill}
        onValueChange={(v) => {
          if (v) {
            setSkill(v);
            setDayLimit(6);
          }
        }}
        aria-label="Filter by skill"
        className="flex flex-wrap gap-1.5"
      >
        {skills.map((s) => (
          <ToggleGroup.Item
            key={s}
            value={s}
            className="h-7 rounded-full bg-well px-3 text-xs text-ink-2 transition hover:text-ink data-[state=on]:bg-ink data-[state=on]:text-base"
          >
            {s}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <p className="mb-1.5 flex justify-between text-xs">
              <span className="font-medium text-ink-2">{g.label}</span>
              <span className="num text-saffron">+{g.items.reduce((a, e) => a + e.amount, 0)}</span>
            </p>
            <ul className="flex flex-col">
              {g.items.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 border-t border-edge/70 py-1.5 text-xs">
                  <span className="num w-10 shrink-0 text-saffron">+{e.amount}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{e.reason}</span>
                    <span className="block truncate text-2xs text-ink-3">
                      {e.skill} · {formatTime(e.at)}
                      {e.capNote && <span className="text-coral"> · {e.capNote}</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-3">
        <span className="num">
          Showing {shownCount} of {list.length} awards · {groups.length} of {all.length} days (last 8 weeks)
        </span>
        {groups.length < all.length && (
          <button type="button" onClick={() => setDayLimit((l) => l + 6)} className="rounded-full bg-well px-3 py-1 text-ink-2 hover:text-ink">
            Show more
          </button>
        )}
      </div>
    </div>
  );
}

function XpLedger() {
  return (
    <Module
      framed
      title="XP history"
      subtitle="Every award from the server with its reason, skill and any cap applied · last 8 weeks"
      className="xl:col-span-12"
      skeleton={{ rows: 6 }}
      empty={{ icon: History, title: "No XP yet", description: "Each validated activity adds an entry with its reason." }}
    >
      {(d) => <Ledger events={d.skillsDetail.events} now={d.now} />}
    </Module>
  );
}

export function SkillsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Skills & attributes"
        description="Skills are lifetime levels earned from validated activity. Attributes measure your current capability from evidence, and can go down."
      />
      <StatStrip
        labels={["Profile level", "XP, last 8 weeks", "Skills with form data", "Attribute coverage"]}
        stats={(d) => {
          const withForm = d.skillsDetail.skills.filter((s) => s.form?.status === "ok").length;
          const windowXp = d.skillsDetail.events.reduce((a, e) => a + e.amount, 0);
          const scored = d.attributes.filter((a) => a.score !== null).length;
          const cov = Math.round((d.attributes.reduce((a, x) => a + x.coverage, 0) / d.attributes.length) * 100);
          return [
            { label: "Profile level", value: String(d.profile.progress.level), accent: true, note: `${d.profile.lifetimeXp.toLocaleString()} lifetime XP` },
            { label: "XP, last 8 weeks", value: `+${windowXp.toLocaleString()}`, note: `across ${new Set(d.skillsDetail.events.map((e) => e.skill)).size} skills` },
            { label: "Skills with form data", value: `${withForm}`, unit: `of ${d.skillsDetail.skills.length}`, note: "needs 4 recent + 8 baseline records" },
            { label: "Attribute coverage", value: `${cov}%`, note: `${scored} of ${d.attributes.length} attributes scored` },
          ];
        }}
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <AttributesDetail />
        <SkillsTable />
        <XpLedger />
      </div>
      <p className="flex items-center gap-2 text-2xs text-ink-3">
        <Chip>Open question</Chip> Discipline, Consistency and Recovery have no form metric defined yet. Which measured
        metric should drive each?
      </p>
    </div>
  );
}
