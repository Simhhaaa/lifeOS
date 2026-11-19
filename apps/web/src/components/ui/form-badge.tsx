"use client";

import { MoveDownRight, MoveRight, MoveUpRight } from "lucide-react";
import {
  trendOf,
  type FormResult,
  FORM_BASELINE_DAYS,
  FORM_MIN_BASELINE,
  FORM_MIN_RECENT,
  FORM_RECENT_DAYS,
} from "@/lib/progression";
import { Chip } from "./chip";
import { Tooltip } from "./info";

/**
 * Performance FORM: recent window vs baseline window (docs/progression-rules.md §3).
 * Never shown as a number unless both windows meet the minimum-data rule.
 */
export function FormBadge({ form, metric }: { form: FormResult; metric: string }) {
  const dir = trendOf(form);
  if (form.status !== "ok" || dir === null) {
    return (
      <Tooltip
        content={`Not enough data for form: needs ${FORM_MIN_RECENT}+ records in the last ${FORM_RECENT_DAYS} days and ${FORM_MIN_BASELINE}+ in the prior ${FORM_BASELINE_DAYS} days (has ${form.recentN} / ${form.baselineN}).`}
      >
        <span tabIndex={0} className="text-2xs whitespace-nowrap text-ink-3">
          No form yet
        </span>
      </Tooltip>
    );
  }
  const pct = Math.round(form.value * 100);
  const Icon = dir === "up" ? MoveUpRight : dir === "down" ? MoveDownRight : MoveRight;
  const tone = dir === "up" ? "mint" : dir === "down" ? "coral" : "neutral";
  const word = dir === "up" ? "up" : dir === "down" ? "down" : "stable";
  return (
    <Tooltip
      content={
        <span>
          <strong className="font-semibold">
            Form {pct > 0 ? "+" : ""}
            {pct}%
          </strong>{" "}
          · {metric}
          <br />
          Last {FORM_RECENT_DAYS} days vs prior {FORM_BASELINE_DAYS}-day baseline. Within ±5% shows as stable.
        </span>
      }
    >
      <span tabIndex={0} aria-label={`Form ${word} ${Math.abs(pct)} percent versus ${FORM_BASELINE_DAYS}-day baseline`}>
        <Chip tone={tone}>
          <Icon size={11} strokeWidth={2.25} aria-hidden />
          <span className="num">{dir === "flat" ? "Stable" : `${pct > 0 ? "+" : ""}${pct}%`}</span>
        </Chip>
      </span>
    </Tooltip>
  );
}
