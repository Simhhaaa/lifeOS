# LIFEOS UI design system: "Petrol & Saffron" (Phase 0, v2)

This file is the source of truth for desktop web UI decisions. Tokens are defined in `apps/web/src/app/globals.css`.

> **v2 replaces v1.** The v1 sidebar-and-card-grid design was rejected as too close to existing dashboards. v2 was rebuilt from scratch with its own layout, palette, type and visualisations. v1 screenshots are kept in `docs/screenshots/phase0/archive-v1/`.

## Concept

The Overview is organised by **time horizon**, not by module:

| Column | Question it answers | Modules |
|---|---|---|
| **Now** | What is my state today, and what did I just do? | Readiness, Today's focus, Recent XP |
| **Trends** | Which way am I moving over weeks? | Study & coding, Strength, Consistency, Insights |
| **Progression** | What am I building over the long run? | Attributes, Skills, Weekly quests, Goals |

Above the columns, a **hero** combines:
- the greeting;
- a one-sentence status built from the page's own data;
- the preview controls;
- the **level panel**, with the level path.

Navigation is a **top bar** (module tabs, with a module menu below 1280px), so there is no sidebar.

## Principles
- **One hue, one job.** Colour carries meaning consistently across the whole app (see Colour roles below).
- **Show the formula, not just the number.** Signature visuals draw the calculation itself:
  - The **level path** plots the XP curve.
  - The **attribute lanes** draw the weighted-signal formula.
  - **Readiness tiles** show each input's points.
- **Soft geometry, dense content.** Rounded slabs (22px), wells (14px) and pill controls, with compact rows inside.
- Progression looks like a system readout. There are no characters, fantasy art or game chrome.
- Dark only for Phase 0. Every colour is a semantic token, so a light theme later is a single `[data-theme="light"]` block.

## Colour roles

| Token | Value | Job |
|---|---|---|
| `base` / `base-glow` | `#081315` / `#0F2A2C` | Page background, with one soft light source at the top right |
| `slab` | `#0C1C1F` | Columns, level panel, popovers |
| `well` / `well-strong` | `#122A2D` / `#1A363A` | Tiles, tracks, controls, hover |
| `edge` / `edge-strong` | `#183034` / `#244449` | Borders and dividers |
| `ink` / `ink-2` / `ink-3` | `#E8F0EC` / `#9BB2AD` / `#688580` | Primary / secondary / metadata text |
| **`saffron`** | `#F4B740` | **Lifetime progression**: XP, levels, primary action, active navigation, focus ring |
| **`sky`** | `#7FB2FF` | **Current capability**: attributes; chart series 1 |
| `lilac` | `#B39DFF` | Chart series 2 |
| **`mint`** | `#5FD4AE` | Improving, done, on plan |
| **`coral`** | `#F27B62` | Declining, missed, needs attention. Never used to mean "failure" |
| `error` | `#FF6464` | System errors only |
| `ref` | `#5F7C77` | Reference lines (averages, targets) |

Every status colour is paired with text or a distinct shape:
- **Consistency:** full, half and ring dots.
- **Missing data:** hatched fills.
- **Trends:** arrows.

## Type

| Role | Font | Use |
|---|---|---|
| Display | **Bricolage Grotesque** (semibold, tight tracking) | Greeting, column titles, large figures, level |
| Interface | **Hanken Grotesk** | Body text, labels, module titles |
| Data | **DM Mono** (`num` utility, tabular) | XP amounts, units, small numbers, keys |

Sizes: 11 · 12 · 13 · 14 (body) · 15 (module title) · 20–30 (figures) · 44–64 (hero).

## Components

**`components/ui`**

| Component | Purpose |
|---|---|
| `Button` | Pill button: primary (saffron), secondary (well), ghost |
| `Chip`, `SampleChip` | Pill labels. `SampleChip` (dashed, hatched dot) marks generated data |
| `Bar`, `Pips`, `Ring` | Progress shown as a rounded bar, per-unit dots (countable targets ≤ 10) or a small ring (level in the top bar) |
| `Sparkline` | Single-series area line with its own scale, for small multiples |
| `FormBadge` | Form % chip (mint up, coral down, neutral stable), or "No form yet" with the reason |
| `MethodInfo`, `Tooltip` | "?" popover explaining how a number is calculated; short hints |
| `EmptyState`, `ErrorState`, `Skeleton` | Shared states |

**`components/dashboard`**

| Component | Purpose |
|---|---|
| `Column` | Time-horizon column with icon, title, description and sample chip. The body is a CSS container, so modules adapt to column width (`@xs`, `@sm`, `@4xl`) |
| `Module` | Titled section inside a column. Handles loading, empty, error and ready states |
| `Hero`, `LevelPath` | Greeting, status, preview controls, level panel |

**`components/shell`**

| Component | Purpose |
|---|---|
| `TopNav` | Brand, module tabs or module menu, search (⌘K / Ctrl K), level ring, + Log, profile |
| `CommandPalette` | cmdk inside a Radix Dialog |

Radix provides the accessible behaviour for popovers, tooltips, dialogs, dropdowns, checkboxes and toggle groups.

## Signature visualisations
- **Level path.** One axis of lifetime XP, with a tick wherever a level begins.
  - Ticks spread out as levels cost more (`100·(L−1)^1.8`), so the curve is visible.
  - The fill shows XP earned. A callout marks the exact XP, and a dashed ring marks the next level.
- **Attribute lanes.** Each attribute is one bar split into its signals.
  - A segment's width is the signal's weight, and its fill is the signal's score against the owner's target.
  - Hatched segments have no data.
  - A coverage note appears below 100%, and the score is hidden below 60%.
- **Strength small multiples.** One card per lift, each with its own scale.
  - Each card shows the latest est. 1RM, the change since the first week shown, and an 8-week sparkline.
- **Recent XP stream.** Entries are grouped by day, with day totals. Only whole days are listed, so the totals are complete.
- **Consistency dots.** A 4×7 Monday-first grid. Dot style shows each day's status:

  | Dot | Status |
  |---|---|
  | Full | On plan |
  | Half | Partial |
  | Coral ring | Missed |
  | Dotted ring | Rest |
  | Saffron ring | Today |

## Module pages (Phase 0 step 4)

All seven module screens share one structure:
1. `PageHeader`:
   - title with the saffron full stop;
   - one-line purpose;
   - `SampleChip`;
   - the module's primary log action (disabled in Phase 0).
2. `StatStrip`: four headline figures, each with its comparison or context line. The labels stay visible while loading, empty or in error.
3. A 12-column grid of **framed modules** (`Module framed`): slab panels with a title, subtitle (units and window), an optional `MethodInfo`, and loading, empty and error states.

| Screen | Modules |
|---|---|
| Academics | Subjects (syllabus, 28-day study) · Assignments & deadlines · Session timeline (7 days × time of day) · DSA progress · Learning & project milestones · Semester record (SGPA/CGPA) |
| Fitness | This week (split) · Recent sessions (expandable set tables with RPE) · Progressive overload (per lift, PRs marked) · Personal records · Volume & frequency (sets per muscle group) · Body (weight, waist, private photos) · Exercise library |
| Health & Recovery | Sleep (28 nights + quality) · Readiness (today's points + 14-day strip) · Steps & runs · Mood, energy & recovery · Resting HR and Hydration (honest empty states) · What's tracked here |
| Productivity | Plan (today / tomorrow / later) · This week agenda (one row per day: deadlines, milestones, workouts, tasks, daily adherence) · Focus sessions · Habits (28-day strips, streaks) · Screen time vs focus time |
| Skills & attributes | Attributes in full (lane plus signals table) · All skills table with a selected-skill detail (evidence rules, weekly XP, XP sources) · XP history (filter by skill, paged by whole days) |
| Goals & quests | Today's objectives · Weekly quests · Suggested challenges · Goals (milestone track, pace projection) · Recently reached · Achievements |
| Analytics | Summary (weekly / 28-day) · Trends & plateaus · Volume vs strength · Productive time of day (heatmap) · Three correlation scatters, each with r, n and "correlation, not cause" |

Rules carried over from the Overview:
- every derived number has a method;
- missing inputs stay visible as missing;
- sample data comes from the same seeded history, so figures match across screens.

## Layout

| Width | Hero | Columns |
|---|---|---|
| ≥1280 | Text and level panel side by side | Now · Trends · Progression (0.95 : 1.3 : 1) |
| 1024–1279 | Stacked | Now · Progression; Trends full width below, its modules in two columns |
| 768–1023 | Stacked | One column: Now, Progression, Trends |

- Content is capped at 1520px, with a 20px (<768) or 32px gutter.
- The top bar shows module tabs at ≥1280px and a module menu below that.

## Data rules
- **Charts:** state units and time window in the subtitle, label the axes, include a legend when there is more than one series, and set `role="img"` with a description.
- **Dates:** from the viewer's clock at runtime, using `Intl`. Weeks start Monday; the ISO week number is shown in the hero. No hardcoded dates.
- **Units:** weight in **kg**.
- **Sample data:**
  - The hero states it.
  - Every column header and the level panel carry `SampleChip`.
  - Nothing is persisted, and checkbox and dismiss interactions are local only.
- **Formulas:** every derived number has a documented method (`docs/progression-rules.md`) and a `MethodInfo` popover or tooltip.
  - Form % is shown only when the baseline rule is met.
  - The strength change is a raw kg difference, not a form %.

## States
`?state=loading|empty|error`, the **Preview state** toggle in the hero or ⌘K → "Show … state" forces a state across the dashboard:
- **Loading:** pill-shaped skeletons.
- **Empty:** a dashed box with an icon, a one-line explanation and one action (disabled in Phase 0).
- **Error:** a dashed coral box with Retry. Other modules are unaffected.

## Accessibility
- **Focus:** a skip link, and a visible saffron focus ring on `:focus-visible`.
- **Labels:** every control is labelled. Progress elements expose `role="progressbar"` or `role="meter"` with values.
- **Grid:** the consistency grid uses `role="grid"` with row headers and an `aria-label` on each cell.
- **Contrast:**
  - `ink` and `ink-2` meet WCAG AA on `slab`.
  - `ink-3` is used only for metadata.
- **Reduced motion:** turns off transitions and animations.

## Mobile (Phase 0 steps 5–6)

The native app is built with Expo in Phase 4. Phase 0 defines it as **390 × 844 pt design frames** on the `/mobile` board (also in ⌘K → "Mobile design frames"). They use the same tokens, fonts and data rules as desktop. Controls inside the frames work, but nothing is saved. Components are in `apps/web/src/components/mobile/{kit,screens,board}.tsx`.

**Navigation:** a bottom tab bar with **Home · Log · Progress · Profile** (spec §2.4). Log is a saffron centre action that opens a sheet from any tab.

**Interaction rules:**
- **Touch targets:** at least 44 pt. Steppers and 1–5 scales stand in for typing.
- **Thumb reach:** the primary action is a full-width pill pinned to the bottom of each flow.
- **Prefilled flows:** a workout starts from your last session of the next split in the rotation; study offers 25/45/60/90 min.
- **Offline first:** every entry is saved locally with a unique ID (idempotency key) and synced later. Pending entries carry a saffron dot and are listed under Profile → Sync with a retry button.
- **Server owns XP:** flows never show awarded XP. The est. 1RM and the readiness preview are labelled as previews.

| # | Frame | Purpose |
|---|---|---|
| 1 | Home | Quick-log chips, readiness, today's plan with habits (tick in place), weekly quests, recent XP |
| 2 | Log sheet | Next workout in the rotation, plus workout, study, coding, check-in, steps and run, habit or task |
| 3 | Progress | Level, attribute lanes, skills with form, links to detail |
| 4 | Workout & sets | Last time, logged sets, kg and reps steppers, optional RPE, live est. 1RM against your best, up next |
| 5 | Study or coding session | Type, subject or area, duration, focus 1–5; coding asks for solved problems; study has an optional outcome |
| 6 | Daily check-in | Sleep (15-min steps) and quality, energy, recovery, optional mood, steps, water and resting HR, readiness preview |
| 7 | Profile & sync | Pending queue with retry, settings (targets, split, units, week start, reminders), export, sign out |
| 8 | Offline | Offline banner; entries saved on the phone are marked |
| 9 | First run | One first step (check-in), what to log next, Level 1 with 0 XP |
