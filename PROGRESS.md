# LIFEOS: progress log

## Phase 1 · Architecture and data contracts (awaiting review)

**Phase 0 is complete and approved:** desktop Overview v2, seven module screens, mobile frames.

**Scope (spec §11):**
- ERD and database constraints;
- API contracts and OpenAPI review;
- progression formula specification;
- security and sync design;
- technical decisions.

Documents only; no backend code until this is approved.

### Done
| Deliverable | File |
|---|---|
| Architecture map and rules | `ARCHITECTURE.md` |
| Agent operating rules | `AGENTS.md` |
| Components, environments, decision log (D1–D16) | `docs/architecture.md` |
| ERD (Mermaid), every table with types, checks, uniques and indexes; retention, backups | `docs/database.md` |
| API conventions plus screen → endpoint map | `docs/api-contracts.md` |
| OpenAPI 3.1 contract: 49 paths, 59 operations, 65 schemas | `docs/api/openapi.yaml` |
| Progression v1: event pipeline, rule table with caps, anti-farming, corrections, timing | `docs/progression-rules.md` §11–14 |
| Threat model, auth, photos, backups, offline queue, conflict policy, security tests | `docs/security-and-sync.md` |

### How the main spec requirements are met
- **Exactly-once XP:**
  - the write, its event, its XP and the idempotency record commit in one transaction;
  - uniques on `(type, source_id)` for events and `(event_id, rule_id)` for XP.
- **No silent overwrite:** `version` plus `If-Match` returns `409` with the server copy; updating a deleted record returns `410`. The conflict table covers every case.
- **The backend owns XP:** request schemas contain no derived fields; XP rules are versioned rows.
- **Privacy:**
  - Argon2id;
  - 15-min access tokens and rotating refresh tokens with reuse detection;
  - cookies on web, SecureStore on mobile;
  - private photos behind 5-min signed URLs;
  - log redaction; foreign IDs return 404.

### Tables added beyond the spec's initial list (each needed by an approved screen)
`personal_targets`, `user_settings`, `dsa_problems`, `learning_milestones`, `semesters`, `workout_templates` (+ exercises), `training_plans`, `cardio_sessions`, `screen_time_records`, `attribute_snapshots`, `goal_milestones`, `insight_dismissals`, `idempotency_keys`, `xp_rules`.

### Verification
- **OpenAPI:**
  - parsed locally with `js-yaml`;
  - every `$ref` resolves and every path parameter is declared;
  - every non-auth mutation requires `Idempotency-Key`;
  - operation IDs are unique and no schema is unused.
- **Not done yet:** a full standards lint with Redocly. The package download was blocked by the session's permissions; it can run once allowed, or in CI in Phase 2.
- **Mermaid diagrams:** written but not rendered here. They render on GitHub and in most Markdown viewers.

### Owner decisions needed before Phase 2
1. **Git:** create a repository in the LifeOs folder (D16). Nothing can be committed safely while the Git root is the home folder.
2. **XP values and caps:** the v1 numbers, including the new daily caps (DSA 150, study 180, coding 200, 2 runs per day) and the new outcome rules for milestones and assessments (progression §12).
3. **Minimums:** a workout needs ≥ 3 working sets for Discipline XP; an on-plan day needs ≥ 3 planned items (§12–13).
4. **Deletes:** deleting an entry reverses its XP with a visible correction (§13). This slightly qualifies "lifetime XP never decreases".
5. **Form metrics** for Discipline, Consistency and Recovery; whether Recovery earns XP; quests and challenges give no XP of their own.
6. **Attribute targets:** set in Settings (proposed) or derived from history.
7. **Import source:** which source for steps and resting HR comes first (CSV, Google Fit / Health Connect, Apple Health). Manual entry works regardless.
8. **Hosting:** Vercel + Render + Neon (spec suggestion), or other providers.

### Next (only after approval)
- Phase 2, backend foundation:
  - FastAPI project per `docs/architecture.md`;
  - Postgres in `docker-compose.yml`, first Alembic migrations from `docs/database.md`;
  - owner CLI, auth, idempotency middleware, problem+json errors;
  - pytest suite including the OpenAPI contract test.

---

## Phase 0 · Steps 5–6: mobile navigation, dashboard and quick-log flows (approved)

**Scope:** design only. The native Expo app is Phase 4, so these are 390 × 844 pt design frames on a `/mobile` board in the web app, in the approved design language, with working controls and nothing saved.

### Done
- **Mobile kit** (`components/mobile/kit.tsx`):
  - phone frame, bottom tab bar (Home · Log · Progress · Profile);
  - screen and flow headers, cards;
  - 44 pt steppers and 1–5 scales;
  - pinned primary button.
- **Nine frames** (`components/mobile/screens.tsx`, `board.tsx`): Home, Log sheet, Progress, Workout & sets, Study or coding session, Daily check-in, Profile & sync, Offline, First run. They use the same sample world as desktop, so the numbers match.
- **Productivity:** "This week" was redesigned as a compact one-row-per-day agenda. Plan sits beside This week and Focus sessions; Habits sits beside Screen time.
- **Command palette:** new "Mobile design frames" entry.
- **Docs:** `docs/ui-design-system.md` has a new Mobile section. Screenshots are in `docs/screenshots/phase0/mobile/`.

### Decisions to confirm
1. The suggested workout is the **next split in the rotation**, prefilled from your last session of that split.
2. **Mood, steps, water and resting HR are optional** in the check-in. Only sleep, energy and recovery are required, because readiness needs all three.
3. **No XP in mobile flows.** XP appears only after the server confirms it on sync.
4. The **daily check-in reminder** (shown as 9:00) is an example setting, not a decided default.

### Verification
- `tsc` and ESLint are clean.
- `/mobile` renders 9 frames with no page errors.
- Flows were tried in the browser: saving a set, switching between study and coding, and the readiness preview.

### Next (only after approval)
- Phase 0 sign-off, then Phase 1: ERD, API contracts, the final progression formulas and the sync design.

---

## Phase 0 · Step 4: desktop module screens (awaiting review)

**Scope:** desktop UI for Academics, Fitness, Health & Recovery, Productivity, Skills & Attributes, Goals & Quests and Analytics, in the approved v2 "Petrol & Saffron" language. No backend, database, authentication or mobile work.

### Done
1. **Shared sample world** (`apps/web/src/lib/world.ts`, `lib/sample/*`). Every screen derives from the same seeded 8-week history as the Overview, so figures agree across pages: PRs, sessions, XP, readiness, quests and goals.
   - Per-module builders: academics, fitness, health, productivity, skills, goals, analytics.
   - `lib/stats.ts` (mean, Pearson r, slope).
2. **Shared page pieces:**
   - `PageHeader` and `StatStrip` (labels kept in every state).
   - Framed `Module` panels.
   - `ui/chart.tsx` (axis, legend, tooltip).
3. **Seven screens**, each with loading, empty and error states. Contents are listed in `docs/ui-design-system.md` → Module pages.
4. **Consistency fixes found while building:**
   - **Today's workout:** it now follows the weekday and the Push → Legs → Pull rotation, and is the same on the Overview, Productivity and Goals. On rest days it's a mobility routine.
   - **XP event times:** they now vary by day. They come from a separate seed, so no other sample value changed.
   - **XP history:** it pages by whole days, so day totals are always complete.
   - **Screen-time sample:** switched to a seed with a typical missing-day rate. The original seed produced an unrealistic run of gaps.
5. **Methods documented:**
   - Analytics summaries and correlations: `docs/progression-rules.md` §8.
   - Goal pace projection, achievements, challenges and CGPA: §9.
   - New open questions: §10.
6. **Navigation:** all seven modules are marked as designed. Settings is still a placeholder.

### Honest gaps shown in the UI (by design)
- **Not logged:** resting heart rate and hydration show empty states that explain how they affect Vitality coverage.
- **Backend Development:** no milestone completed in the window, so it has no form.
- **Missing form metrics:** Discipline, Consistency and Recovery show "No metric" (open question).
- **Correlation sample size:** Volume vs strength has n = 8, below the n ≥ 10 minimum, so it shows "Not enough data".

### Files
- `apps/web/src/lib/{world,stats}.ts`
- `apps/web/src/lib/sample/{shared,academics,fitness,health,productivity,skills,goals,analytics}.ts`
- `apps/web/src/lib/sample-data.ts`:
  - exported helpers;
  - `plannedWorkoutToday`;
  - session end times;
  - whole-day XP list.
- `apps/web/src/lib/progression.ts`: `sleepPoints` and `scalePoints`; the same readiness rule.
- `apps/web/src/components/page/{page-header,stat-strip}.tsx`, `components/ui/chart.tsx`
- `apps/web/src/components/modules/{academics,fitness,health,productivity,skills,goals,analytics}-page.tsx`
- `apps/web/src/app/{academics,fitness,health,productivity,skills,goals,analytics}/page.tsx`
- `docs/progression-rules.md` §8–10, `docs/ui-design-system.md` (Module pages), `docs/screenshots/phase0/modules/*`

### Verification
- `npm run build` passes; ESLint and `tsc` are clean.
- Headless Chromium on all 8 pages at 768 / 1024 / 1280 / 1440 px: no page errors, no console errors, no horizontal overflow.
- Empty (Fitness), error (Analytics) and loading (Skills) states checked.
- No automated UI tests yet; they are planned for Phase 3, per the spec.

### Open questions for review
1. Should Programming and Learning form use outcome metrics instead of minutes once milestone and assessment data exists?
2. Attribute personal targets: set them in Settings, or derive them from history?
3. Should the Insights card hide entirely when there are no insights?
4. Form metrics for Discipline, Consistency and Recovery?
5. Should Recovery earn XP at all?
6. Should quests or challenges ever award XP? The current draft says no.

### Next (only after approval)
- Phase 0 steps 5–6: mobile navigation and dashboard, then mobile quick-log flows (workout sets, study session, daily check-in).
- Settings screen (targets, split, preferences) if you want it designed in Phase 0.

---

## Phase 0 · Desktop Overview dashboard, v2 (approved)

The v1 design (sidebar, card grid, restrained blue) was rejected as too close to existing dashboards; its screenshots are in `docs/screenshots/phase0/archive-v1/`. **v2** was rebuilt from scratch and approved:
- **Layout:** Now / Trends / Progression columns, a hero with the level path, and top navigation.
- **Palette:** Petrol & Saffron.
- **Type:** Bricolage Grotesque, Hanken Grotesk, DM Mono.
- **Visuals:** level path, attribute lanes, strength small multiples, XP stream, consistency dots.

### Decisions in force (owner-approved)
- Tailwind CSS v4 + Radix primitives; no full component library.
- Weight in kg. Weeks start on Monday.
- Dark only for Phase 0, with semantic tokens.
- Attributes: Intelligence, Strength, Endurance, Discipline, Vitality, with evidence-based formulas.
- ⌘K and Ctrl+K open the command palette.
- No hardcoded dates or fake live metrics. Sample data is labelled.
- The form % baseline is defined before any form % is shown.
- Top navigation replaces the sidebar, and the Petrol & Saffron palette replaces restrained blue: both approved with v2.
