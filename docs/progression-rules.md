# Progression rules (v1 proposed, Phase 1)

> **Status:** v1 proposed for owner review. §1–10 were drafted in Phase 0 and drive the UI preview's sample data. §11–14 add the Phase 1 engine specification: event pipeline, the v1 rule table with caps, anti-farming, deletes and corrections, and timing.
> Items marked **Owner decision** need a yes/no. Everything else becomes the Phase 5 implementation target once approved.
> The backend owns every calculation (spec §4.2); clients never send XP. Preview implementation: `apps/web/src/lib/progression.ts`.

## 1. Separate concepts (spec §4.1)

| Concept | Shown as | Can decrease? | Source |
|---|---|---|---|
| Lifetime XP | Total, level bar | Never | Sum of server-validated XP transactions |
| Level (profile / skill) | `Lv N` + bar to next | Never | Lifetime XP → level curve (§2) |
| Form (current performance) | `+9%`, `Stable`, `-46%`, or `—` | Yes | Recent window vs baseline (§3) |
| Consistency | `x / y days on plan` + 4-week grid | Yes | Planned vs completed items (§5) |
| Readiness | High / Moderate / Low | Yes | Today's self-reported inputs (§6) |
| Attributes | 0–100 score + data coverage | Yes | Weighted evidence signals (§4) |

## 2. Level curve

The cumulative XP needed to reach level `L` is `scale × (L − 1)^1.8`, rounded to the nearest 10.

- Profile: `scale = 100` (level 10 ≈ 5,230 XP; level 20 ≈ 20,000 XP)
- Skill: `scale = 25`

### Illustrative XP awards (Phase 0 sample; the v1 rule table with caps is §12)

| Event | XP | Cap |
|---|---|---|
| Focused study session | `floor(minutes / 3)` | 60 per session |
| Coding session | `floor(minutes / 2.5)` | 80 per session |
| DSA problem solved | Easy 10 · Medium 20 · Hard 35 | (daily cap to be set in Phase 1) |
| Workout session completed | 20 Discipline | 1 per day |
| New estimated-1RM PR | 40 Strength | per lift, only on measured improvement |
| Run | `15 + 3 × km` Endurance | 30 per run |
| Day on plan (≥ 80% of planned items done) | 10 Consistency | 1 per day |

Every award keeps its reason, and a cap note when a cap reduced it. Both are shown in **Recent XP**.

## 3. Performance form: baseline and calculation

**Defined before any form % is shown (Phase 0 requirement).**

- **Recent window:** the last 14 calendar days, including today.
- **Baseline window:** the 28 calendar days before that (days 15–42 back).
- **Form** = `(mean(recent) − mean(baseline)) / mean(baseline)`.
- **Volume metrics** (minutes, problems): days with no record count as 0 in the mean.
- **Level metrics** (estimated 1RM, running speed): days with no record are skipped.
- **Minimum data:** at least 4 recorded days in the recent window and 8 in the baseline window, and a baseline mean above 0. Otherwise the UI shows `—` with the tooltip "Not enough data (has r / b)".
- **Stable band:** |form| < 5% is shown as **Stable**.
- Colour: up → green, down → amber (never red: a dip is information, not failure), stable → muted.

| Skill | Form metric | Kind |
|---|---|---|
| Programming | Daily focused coding minutes | volume |
| DSA | Difficulty-weighted problems per day (E1 · M2 · H3) | volume |
| Learning | Daily focused study minutes | volume |
| Strength | Per-session est. 1RM divided by that lift's first value in the window (lift-neutral index) | level |
| Endurance | Running speed, km/h | level |
| Backend Development | Project milestones (no records yet → `—`) | volume |

**Open question for review:** activity-volume form (minutes) measures output, not skill. Should Programming and Learning form use outcome metrics (milestones, assessment scores) once those exist?

## 4. Attributes (evidence-based formulas)

Attributes describe **current capability** and are separate from lifetime levels. They are **not copies of skill levels** (spec §3.6).

**General rule**
- Each signal is scored 0–100, usually `min(100, value / personal target × 100)`.
- Attribute = `Σ(wᵢ · scoreᵢ) / Σ(wᵢ)` over the signals that have data.
- **Coverage** = the share of total weight that had data.
- If coverage < **60%**, no score is shown ("Not enough data").
- Personal targets are set by the owner in Settings (Phase 3). The sample uses placeholder targets.
- Session counts never raise Strength or Intelligence by themselves.

### Intelligence
| Signal | Weight | Score |
|---|---|---|
| Learning milestones and assessment results (90 d) | 0.40 | count vs target (sample: 6) |
| Difficulty-weighted DSA problems solved (28 d) | 0.35 | vs target (sample: 40) |
| Focused study + coding hours/day (14 d) | 0.25 | vs target (sample: 4 h) |

Outcomes (milestones, assessments, problems solved) carry 75% of the weight; time carries 25%.

### Strength
| Signal | Weight | Score |
|---|---|---|
| Latest est. 1RM per tracked lift vs personal target, averaged | 0.70 | sample targets: bench 95, squat 130, deadlift 160 kg |
| 8-week est. 1RM change (mean of the first 2 weeks vs the last 2) | 0.30 | +5% = 100, ≤0% = 0 |

Attendance does not count. Est. 1RM uses the Epley formula, `load × (1 + reps/30)`, valid for 1–10 reps only.

### Endurance
| Signal | Weight | Score |
|---|---|---|
| Average running speed (28 d) vs target | 0.50 | sample: 11 km/h |
| Weekly running distance (28 d average) vs target | 0.30 | sample: 15 km |
| Daily steps (14 d) vs target | 0.20 | sample: 8,000 |

### Discipline
| Signal | Weight | Score |
|---|---|---|
| Planned items completed (28 d) | 0.50 | completion % |
| Habit completion (28 d) | 0.30 | completion % |
| Focus sessions finished as planned | 0.20 | % (not tracked yet → missing) |

### Vitality
| Signal | Weight | Score |
|---|---|---|
| Sleep duration (14 d) vs target | 0.40 | sample target 7.5 h |
| Self-rated energy and recovery (14 d, of 5) | 0.30 | mean / 5 |
| Resting heart-rate trend | 0.15 | manual or imported; missing in the sample |
| Hydration vs target | 0.15 | missing in the sample |

Vitality is a self-tracking summary, not a health assessment. No medical claims.

## 5. Consistency
- A day is **on plan** when ≥ 80% of its planned items were completed, **partial** at 40–79%, and **missed** below 40%.
- Days with nothing planned are **rest** and are excluded.
- Today is not scored until it ends.
- The headline is "on-plan days this week / days with a plan so far", compared with the average of the prior 3 weeks. Weeks start on **Monday**.

## 6. Readiness
Points from today's check-in:
- Sleep: ≥ 7.5 h = 2, ≥ 6.5 h = 1, otherwise 0.
- Energy (1–5): ≥ 4 = 2, 3 = 1, otherwise 0.
- Recovery (1–5): same as energy.

Total 5–6 = **High**, 3–4 = **Moderate**, 0–2 = **Low**. Readiness is shown only when all three inputs are logged. It is a planning aid, not medical advice.

## 7. Insights
Insights are rule-based and limited to 3. Each one states its data, time window and method, can be dismissed, and is shown only when its condition holds:
- **Correlation, sleep → study:** mean study minutes after ≥ 7 h vs < 7 h sleep (28 d). Needs n ≥ 5 per group and a difference ≥ 15%. Always labelled as a correlation.
- **Plateau:** the best est. 1RM in the last 3 weeks does not exceed the best from the 5 weeks before.
- **Trend:** coding form, shown when |change| ≥ 10%.

## 8. Analytics methods (module screens)
- **Summaries:** complete Mon–Sun weeks ("Last week" vs "Week before") or the last 28 days vs the 28 before. Changes within ±5% are shown as "same".
  - Colour marks only the direction of change; it doesn't mean good or bad.
- **Correlations:** Pearson r over paired days. The pairings are:
  - Previous night's sleep with study minutes.
  - Sleep before a session with that top set as % of the lift's best so far.
  - Entered screen time with focused minutes.
  - Weekly volume with the strength index.
- **Correlation rules:**
  - Needs **n ≥ 10** pairs, otherwise "Not enough data".
  - Strength of |r|: < 0.3 weak, < 0.5 moderate, otherwise strong.
  - Always labelled "Correlation, not cause".
- **Strength index:** for each tracked lift, weekly best est. 1RM ÷ that lift's first week, averaged across lifts, as %.
- **Productive time of day:** focused minutes by weekday × 3-hour start block (06–24), last 28 days.
- **Trends and plateaus:** the same form and plateau rules as §3 and §7.

## 9. Goals, achievements and challenges
- **Goal pace projection:** a straight-line extension of the recent rate.
  - Lifts: least-squares slope of weekly best est. 1RM over 8 weeks.
  - Syllabus goals: units completed per week over the last 4 weeks.
  - "On pace" means the projected date is on or before the due date. No upward trend means no projection.
- **Achievements:** fixed, measurable rules checked against logs. Attendance alone never unlocks one. The unlock date is the first day the rule was met. Sample set:
  - 100 DSA problems.
  - 50 km of logged runs.
  - Squat est. 1RM ≥ 1.5× bodyweight.
  - Bench est. 1RM ≥ 1.2× bodyweight.
  - 20 h of focus in one week.
  - 7 nights in a row with 7 h+ sleep.
  - 4 weeks in a row with ≥ 4 on-plan days.
  - SGPA ≥ 9.0.
- **Adaptive challenges:** fixed rules on the last 4 complete weeks (or the last 7 nights for sleep).
  - Running: +10% or +1 km on the weekly average, whichever is larger.
  - DSA: +10% or +1 problem, plus one Hard problem if none was solved in 14 days.
  - Sleep: two more 7.5 h+ nights than last week, up to 7.
  - Accepting a challenge turns it into a quest. Quests add no XP of their own.
- **CGPA:** Σ(SGPA × credits) ÷ Σ(credits) over completed semesters.

## 10. Open questions added by the module screens
1. Discipline, Consistency and Recovery have no **form metric**. Which measured metric should drive each?
2. Recovery has **no XP rule**. Should it earn XP at all, given that recovery should be based on inputs and trends (spec §4.3)?
3. Should quests and challenges ever award XP? The current draft says no, because the underlying activity already earned it.


## 11. Event pipeline (Phase 1)

```text
write (session, set, problem, check-in…) ─▶ service validates ─▶ activity_event (unique: user, type, source_id)
   ─▶ rules matching event.type, valid at occurred_at ─▶ xp_transactions (unique: event_id, rule_id)
   ─▶ skill_profiles cache (lifetime_xp, level) ─▶ goal progress / quest progress / achievement checks
```
- **One transaction.** The write, the event, its XP and the idempotency record commit together or not at all. That is how "exactly once" (spec §9 step 5) is met.
- **Events are facts with a snapshot** (`payload`). Rules read only the payload, so a rule re-run gives the same answer.
- **Daily events** (`day.on_plan`) are emitted by a job after the owner's local midnight, never during the day (today isn't scored until it ends).
- **Measured-improvement events** (`lift.e1rm_pr`) compare against the best value **before** this event, using sets of 1–10 reps only.

## 12. v1 rule table (stored in `xp_rules`, version 1)

| Rule id | Event | Skill | Amount | Caps |
|---|---|---|---|---|
| `study.focus_minutes` | `study_session.logged` | Learning | `floor(minutes / 3)` | 60 per session · **180 per day** (new) |
| `coding.focus_minutes` | `coding_session.logged` | Programming | `floor(minutes / 2.5)` | 80 per session · **200 per day** (new) |
| `dsa.solved` | `dsa_problem.solved` | DSA | Easy 10 · Medium 20 · Hard 35 | **150 per day** (new; was open). A duplicate problem URL earns nothing. |
| `workout.completed` | `workout.completed` | Discipline | 20 | 1 per local day; needs ≥ 3 working sets |
| `lift.e1rm_pr` | `lift.e1rm_pr` | Strength | 40 | Per lift; the improvement must be ≥ 0.5 kg est. 1RM (filters rounding noise) |
| `cardio.run` | `cardio.logged` (kind = run) | Endurance | `15 + 3 × km` | 30 per run · **2 runs per day** (new) |
| `day.on_plan` | `day.on_plan` | Consistency | 10 | 1 per day; needs ≥ 3 planned items that day |
| `milestone.learning` | `milestone.completed` (learning) | Learning | 30 | none; outcome evidence (new) |
| `assessment.recorded` | `assessment.recorded` | Learning | `round(20 + 30 × score / max)` | none; outcome evidence (new) |
| `milestone.project` | `milestone.completed` (project) | Backend Development / Programming | 50 | none; outcome evidence (new) |

The new values are **proposals**. **Owner decision:** approve these numbers, or tune them before Phase 5.

## 13. Anti-farming and corrections
- **Caps are always applied by the server** and recorded in `cap_note`, so the UI can show "Session cap 60 XP applied".
- **Plausibility bounds** come from database checks: a session is at most 600 min, at most 24 h of sessions per day, sets at most 600 kg. Anything over is rejected with `422`, not capped.
- **Minimum planning:** `day.on_plan` needs ≥ 3 planned items, so planning one trivial task can't farm Consistency XP.
- **Duplicates:** one event per source record; DSA problems are unique by URL.
- **Editing an entry** (e.g. changing minutes) re-evaluates its rules. Any difference becomes a `correction` transaction with reason "Entry edited", up or down.
- **Deleting an entry** adds a `correction` that reverses its XP. **Owner decision:** reverse the XP (proposed, keeps the totals honest), or keep it (simpler, but inflatable).
- **Never below zero:** corrections can't take a skill total below 0. Lifetime XP shown to the owner is Σ awards + corrections. "Lifetime XP never decreases" holds for real activity; corrections exist only to undo mistakes and are visible in history.
- **Rule changes apply forward** from `valid_from`. Past transactions keep their rule version, and nothing is recomputed retroactively.

## 14. Timing and time zones
- Day boundaries follow `users.timezone`. Each record's `local_date` is fixed at write time from the client's `started_at` and the owner's timezone, so travelling doesn't move past days.
- **Weekly reset** is Monday 00:00 local: quests roll over and challenges are regenerated.
- **Nightly jobs** run at 03:00 local:
  - `day.on_plan` events for yesterday;
  - attribute snapshots;
  - achievement checks;
  - idempotency-key and tombstone cleanup.
- **Form, trends, correlations** are computed on read (§3, §8). Windows are calendar days in local time.

## Owner decisions collected (Phase 1)
1. v1 XP values and the new daily caps (§12).
2. Deleting an entry reverses its XP (§13).
3. Form metrics for Discipline, Consistency and Recovery (from §10).
4. Whether Recovery earns XP at all (from §10).
5. Quests and challenges award no XP of their own (from §10).
6. Attribute targets are set by the owner in Settings, with placeholders until set. The alternative is deriving them from history (from Phase 0).
