# LIFEOS: progress log

## Phase 3b · Academics on the real API (awaiting review)

**Scope:** the second Phase 3 slice. The whole Academics screen now runs on real data, with working logging. Fitness, Overview and the read views come next.

### Done
- **Backend** (`app/api/v1/academics.py`, `app/services/academics.py`, `app/schemas/academics.py`):
  - **Subjects:** list, create, patch, delete. `units_done` can't exceed `units_total`; a duplicate short name gives 409.
  - **Study and coding sessions:**
    - A future start gives 422.
    - `local_date` comes from the owner's timezone.
    - A coding session and its solved problems are written in one transaction.
  - **DSA problems:** a repeated problem URL gives 409.
  - **Assignments, milestones and semesters:**
    - Assignments: list, create, update.
    - Milestones: learning and assessment go to `learning_milestones`, project to `coding_milestones`.
    - Semesters: CGPA is computed on the server, weighted by credits.
  - **`/study/analytics`:**
    - study and coding hours, last 14 days vs the 14 before;
    - per-subject figures over 28 days;
    - a 7-day session timeline;
    - DSA lifetime count, plus an 8-week breakdown by difficulty, topic and week;
    - the next deadline.
  - **Shared helpers** (`repositories/owned.py`):
    - `require_ref`: a referenced subject that isn't yours gives 422, so another user's rows can't be read or linked;
    - `insert_owned`: unique violations become 409 `duplicate`;
    - `local_date_for` / `today_for`.
  - Clients still never send XP. Session XP waits for the Phase 5 engine, and the UI says so.
- **Web** (`components/live/academics/`, `components/ui/form.tsx`): every Academics panel is live.
  - Stat strip.
  - Subjects table, with a +/− unit stepper that uses If-Match.
  - Assignments, with the status changed from the chip.
  - Session timeline.
  - DSA progress.
  - Milestones (tick to complete or undo).
  - Semester record, with inline SGPA edit.
  - Dialogs: log session (study or coding, with solved problems), subject, assignment, milestone, semester, problem.
  - Loading, empty and error states throughout; conflict and validation errors are shown inline.
  - On narrow widths the header now wraps its actions instead of squeezing the description.
- **UI test:** `e2e/academics.spec.ts` covers:
  - subject, then a unit step;
  - session, which shows in the subject's 28-day figures;
  - assignment, then a status change;
  - DSA problem: the count goes up, and the same URL a second time is refused;
  - milestone, ticked done;
  - semester, then an SGPA edit that persists after a reload.
- **CI:** a new **e2e** job runs on a fresh Postgres.
  - It migrates, seeds an owner, starts uvicorn and runs Playwright.
  - The signing key and password are generated for each run and masked; no secrets are stored.
  - On failure it uploads traces.

### Contract additions — need your sign-off (additive only; nothing existing changed)
The approved screens need these operations, which the Phase 1 contract lacked. They're added to `docs/api/openapi.yaml` (now 63 operations):
1. `GET /milestones` (listMilestones): the Milestones panel.
2. `PATCH /milestones/{id}` (updateMilestone): tick done, or record a score.
3. `POST /semesters` and `PATCH /semesters/{id}` (createSemester, updateSemester): add a semester and edit its SGPA.

Also, `PATCH /subjects/{id}` now takes a `SubjectPatch` (every field optional) rather than the full `SubjectInput`.

### Verification
- **Backend:** pytest **44 passed** (10 new academics tests); ruff clean.
  - Mutation check: with `require_ref` disabled, the ownership test fails as it should.
- **Web:** `tsc` and eslint clean.
- **Playwright:** **4 passed** (3 existing + academics) against the real API and Postgres.
- Screenshots of the populated page checked at 1440 px and at narrow width.
- **Note on local runs:** the e2e tests sign in as the local dev owner. Only subjects can be deleted through the API, so a local run leaves records named "E2E …" on that account. CI uses a fresh database.

### Next (only after approval)
- Phase 3c: Fitness (workouts, sets, cardio, body measurements, training plan) on the real API, in the same pattern.

---

## Phase 3a · CI, real login, first live screens (approved, merged; CI green)

**Scope:** the first slice of Phase 3 (desktop web).
- **Here:** CI; login and session; Productivity → Plan and Health → Readiness on the real API.
- **Later slices:** Academics, Fitness and Overview endpoints and screens, then the Skills, Goals and Analytics read views. Those show empty states until the Phase 5 progression engine.

### Done
- **CI** (`.github/workflows/ci.yml`):
  - **backend:** ruff lint and format check, plus pytest against a Postgres 16 service (includes the OpenAPI contract test and `alembic check`);
  - **web:** `tsc`, eslint, `next build`.
- **Web ↔ API:**
  - `next.config.ts` proxies `/api/v1/*` to FastAPI (`LIFEOS_API_ORIGIN`, default `127.0.0.1:8000`), so the httpOnly cookies are same-origin.
  - `lib/api/client.ts`:
    - sends CSRF on every mutation and a fresh `Idempotency-Key` per action;
    - sends `If-Match` versions;
    - retries once after a 401, with a shared refresh;
    - turns problem+json into `ApiError`, and handles non-JSON proxy errors.
  - `lib/api/use-resource.ts`: fetch, reload and optimistic updates.
- **Login and session:**
  - `/login` page (no sign-up). Error messages never reveal whether a username exists.
  - The app shell sends every other route to `/login?next=…`, and shows a "can't reach the server" state when the API is down.
  - A profile menu with **Log out**.
- **Live panels** (with a mint **Live** chip; page headers say which panels are still sample data):
  - **Productivity → Plan** (`/tasks`):
    - add (with priority), tick or untick, delete;
    - a 7-day window grouped into Today, Tomorrow and Later;
    - version conflicts and remote deletes show a notice and reload, so nothing is silently overwritten.
  - **Health → Readiness** (`/daily-logs/{today}`):
    - an empty state, then readiness with points per input;
    - a check-in dialog (sleep stepper and 1–5 scales);
    - on a conflict, "Keep server's / Keep mine".
- **UI tests:** Playwright (`apps/web/e2e/live.spec.ts`, `npm run test:e2e`):
  - login redirect and wrong password;
  - task add, complete (persists across reload), conflict from another device, delete;
  - check-in readiness;
  - logout ends the session.
- **Dev tooling:**
  - `backend/scripts/dev_owner.py` creates a **local-only** test owner from `LIFEOS_DEV_OWNER_*` in the git-ignored `backend/.env`. It refuses outside `LIFEOS_ENV=local`.
  - The API reads `backend/.env` from any working directory.
  - `.claude/launch.json` gains an API entry.

### Bugs found and fixed by the end-to-end run
1. **Logout didn't end the session.** The client skipped CSRF on `/auth/*`, so the server answered 403 while the UI showed the login page. Now CSRF is sent on every mutation.
2. **Wrong error message when the API was down.** It said "password doesn't match". Server and network failures now say the server can't be reached, and the shell shows an offline state.
3. **Health showed two answers for readiness.** The sample "Readiness today" stat contradicted the live panel, so it was replaced with a sample-only stat.

### Verification
- **Backend:** pytest **34 passed**; ruff check and format clean.
- **Web:** `tsc` clean, eslint clean, `next build` passes.
- **Playwright:** **3 passed** against the real API and Postgres. The same flow also ran as a scripted check: no page errors, screenshots reviewed.
- **Not covered yet:**
  - CI runs the backend and web build but not the Playwright suite, which needs the API, database and web together; that comes next.
  - The new CI workflow hasn't run on GitHub yet. It runs on the next push.

### Next (only after approval)
- Phase 3b: Academics endpoints and screen (subjects, study/coding sessions, DSA problems, assignments, milestones, semesters), in the same pattern, with tests.
- Run Playwright in CI (API + Postgres + web).

---

## Phase 2 · Backend foundation (approved, merged)

**Branch:** `phase-2-backend`. Phases 0–1 are on `main` in `github.com/Simhhaaa/lifeOS`.

### Done
- **Repository:**
  - Git initialised in the LifeOs folder, root `.gitignore` (secrets and build output excluded);
  - Phases 0–1 committed and pushed to `main`.
- **Local stack:** `docker-compose.yml` runs Postgres 16 on `127.0.0.1:54329`, with a `lifeos_test` database for pytest.
- **Backend** (`backend/`, Python 3.13, FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2):
  - **Configuration:** environment variables only; `.env` is git-ignored and `.env.example` is committed.
  - **Errors:** problem+json with stable codes.
  - **Passwords:** Argon2id, with equal-time handling for unknown users.
  - **Tokens:** Ed25519 JWT access tokens (15 min) and opaque rotating refresh tokens. Only their hashes are stored, and reusing an old one revokes the whole session family.
  - **Web sessions:** httpOnly cookies with CSRF double-submit. Mobile uses bearer tokens.
  - **Login rate limit:** 5 attempts per 15 min per IP and username.
  - **Idempotency:** stored in the same transaction as the write. Replays return the stored response; the same key with a different body gets 422; concurrent duplicates write once.
  - **Ownership:** foreign or missing records return 404. `If-Match` versions return 409 with the server copy; deleted records return 410.
  - **Reference endpoints:** auth (login, refresh, logout, `/me`), tasks CRUD, daily check-in (with the offline merge policy and readiness), and `/sync/changes` delta pull with tombstones.
  - **Owner CLI:** `gen-key` and `create-owner`. There is no signup endpoint.
- **Database:**
  - first Alembic migration with all **41 tables** from `docs/database.md`;
  - `change_seq` sequence plus triggers on 27 synced tables;
  - an **append-only XP ledger**: a trigger blocks UPDATE and DELETE.
  - Upgrade, downgrade and upgrade all verified.
- **Tests:** 34 pytest tests against real Postgres:
  - auth;
  - idempotency, including concurrency;
  - validation, including rejecting any XP field;
  - conflicts and tombstones;
  - ownership isolation with a second, test-only user;
  - the daily-log merge policy;
  - sync paging;
  - ledger immutability;
  - the **OpenAPI contract test** (implemented operations and required headers match `docs/api/openapi.yaml`);
  - `alembic check` (models equal migrations).

### Verification
- `pytest`: **34 passed**. `ruff check` and `ruff format`: clean.
- **Mutation check:**
  - turning idempotency off makes 3 tests fail;
  - turning the version check off makes 2 tests fail.
  - Both restored afterwards.
- **Real server boot:** `uvicorn` with `.env` gives `/healthz` 200, `/docs` 200, and unauthenticated `/api/v1/me` returns 401 problem+json.
- **Contract coverage:** 11 of 59 operations are implemented. The rest land with their screens in Phases 3–6.
- **Not yet done:**
  - CI (GitHub Actions) isn't set up;
  - the Redocly OpenAPI lint is still pending, because the package download was blocked by this session's permissions.

### Known limitations (tracked)
- **Sync cursor:** two transactions committing out of order can, in theory, make a pull skip a row (a lower `change_seq` committed after a reader passed it). It's harmless for one owner with low concurrency. Fix before Phase 4 mobile sync: a transaction-id watermark, or an overlap window.
- **Rate limiter:** in-process, fine for one API instance. It moves to Postgres or Redis if the API is scaled out.

### Owner decisions still open (from Phase 1; not needed for Phase 2)
- XP values and caps.
- Minimum sets and planned items.
- XP reversal on delete.
- Form metrics for Discipline, Consistency and Recovery.
- Attribute targets.
- Import source.
- Hosting.

### Next (only after approval)
- CI on GitHub Actions: lint, tests with a Postgres service, contract test.
- Phase 3, desktop web:
  - real login screen;
  - replace the sample data with API calls screen by screen;
  - implement each screen's endpoints in the same pattern.

---

## Phase 1 · Architecture and data contracts (approved)

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
