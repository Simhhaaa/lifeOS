# LIFEOS — Master Product & Engineering Specification

**Status:** Initial source of truth  
**Product direction:** Personal-first, private, cloud-synced life dashboard  
**Design priority:** UI/UX first. No feature implementation before the UI direction and core screen layouts are approved.

---

## 1. Product vision

LIFEOS is a personal operating system for tracking and understanding progress across academics, programming, fitness, recovery, productivity, and long-term skills.

It takes inspiration from the progression mechanics of Solo Leveling—levels, XP, attributes, quests, milestones—but presents them through a practical, premium, minimal interface.

### Product principles

1. **Real progress over vanity metrics.** Activity counts are not proof of improvement.
2. **Lifetime progression is permanent.** Lifetime XP never decreases.
3. **Current performance is dynamic.** Recent performance, consistency, recovery, and trends can improve or decline independently of lifetime XP.
4. **One source of truth.** Web and mobile use the same backend and cloud database.
5. **Works without AI APIs.** Core functionality and intelligence must not depend on paid LLM APIs.
6. **Personal-first.** One owner, private login, no public registration. Avoid unnecessary multi-tenant complexity while keeping ownership fields where useful.
7. **No nutrition duplication.** Calorie, protein, and meal tracking are out of scope; MessMate remains separate.
8. **Useful, not distracting.** No excessive gamification, noisy notifications, or decorative charts without a decision-making purpose.

---

## 2. UI/UX first — mandatory starting phase

### 2.1 Visual direction

- Dark-first interface.
- Near-black / charcoal surfaces with restrained blue accent.
- High contrast, readable typography, consistent spacing.
- Premium, technical, calm, and information-dense without clutter.
- Subtle borders and restrained elevation; avoid excessive gradients and glow.
- No anime characters, fantasy backgrounds, cartoon visuals, or unnecessary animations.
- Progression elements should feel like a refined system interface, not a mobile game.

### 2.2 Design workflow

**Do not start backend or feature implementation until the following design checkpoints are reviewed.**

1. Establish design tokens: colors, typography, spacing, radii, shadows, chart palette, icon rules.
2. Create desktop information architecture and navigation.
3. Design desktop dashboard at a realistic desktop viewport.
4. Design key module screens: Academics, Fitness, Health & Recovery, Productivity, Skills, Goals, Analytics.
5. Design mobile navigation and mobile dashboard.
6. Design mobile quick-entry flows for workouts, study sessions, and daily logs.
7. Define responsive behavior, loading states, empty states, error states, and confirmation states.
8. Review and approve the screen layouts before implementation.

### 2.3 Initial desktop shell

Suggested navigation:

- Overview
- Academics
- Fitness
- Health & Recovery
- Productivity
- Skills
- Goals & Quests
- Analytics
- Settings

Dashboard content should prioritize:
- Today's focus / planned tasks
- Weekly consistency
- Study and coding activity
- Workout and strength progression
- Recovery snapshot
- Skill levels and recent XP events
- Active goals and milestones
- A small number of useful trend insights

Avoid showing every metric at once. The overview is a decision surface, not a database dump.

### 2.4 Mobile experience

Mobile is a native companion app optimized for fast logging and checking progress.

Primary navigation should expose a small number of destinations, for example:
- Home
- Log
- Progress
- Profile

The Log action should make it quick to record:
- Workout and exercise sets
- Study session
- Coding session
- Sleep / steps / mood / energy
- Habit or task completion

Mobile must support offline pending actions and sync them when connectivity returns.

### 2.5 UI acceptance criteria

- Desktop and mobile share the same design language and feature semantics.
- Core actions are reachable without hunting through menus.
- Forms have sensible defaults and validation.
- Charts communicate units, time range, and context.
- Every module has useful empty, loading, and error states.
- Accessibility: keyboard navigation on web, labels for controls, readable contrast, and touch targets on mobile.
- No fake metrics or fabricated activity in demo content; clearly label sample data.

---

## 3. Product modules

### 3.1 Overview dashboard
A concise summary of today's plan, recent activity, recovery, goals, skill progression, and meaningful trends.

### 3.2 Academic Intelligence
- Subjects and study sessions
- Focused study duration
- Coding sessions and coding hours
- DSA progress and problem-solving milestones
- Project milestones
- Assignments and deadlines
- CGPA / semester academic records
- Learning milestones

### 3.3 Fitness Intelligence
- Workout splits and workout sessions
- Exercise library
- Sets, reps, load, and optional RPE
- Personal records
- Progressive overload history
- Training volume and frequency
- Body measurements and progress photos

Do not treat merely attending the gym as proof of strength improvement.

### 3.4 Health & Recovery
- Sleep duration and quality
- Steps and general activity
- Resting heart rate, where manually entered or imported from a supported source
- Hydration
- Mood and energy
- Subjective recovery

No calorie, protein, macro, or meal tracking.

### 3.5 Productivity
- Daily planning
- Tasks and priorities
- Focus sessions
- Habits and routines
- Calendar / deadlines
- Screen-time records, if entered or imported

### 3.6 Skills & Attributes
Track specific skills separately from broader attributes.

Example skills:
- Programming
- DSA
- Backend Development
- Learning
- Strength
- Endurance
- Discipline
- Consistency
- Recovery

Attributes represent broader capabilities derived from multiple relevant signals. They must not be simple copies of skill levels.

### 3.7 Goals & Quests
- Daily and weekly objectives
- Longer-term goals
- Milestones
- Achievement unlocks
- Adaptive challenges based on recent history

### 3.8 Life Analytics
- Weekly and monthly summaries
- Trends and plateaus
- Study duration vs. sleep patterns
- Sleep vs. workout performance
- Training volume vs. strength progression
- Screen time vs. focus time
- Productive time-of-day patterns

Clearly label correlations as correlations, not causes. Do not make medical claims.

---

## 4. Progression engine

### 4.1 Separate progression concepts

Maintain separate values for:

- **Lifetime XP:** cumulative earned XP; never decreases.
- **Skill level:** derived from lifetime skill XP using a documented progression curve.
- **Current performance:** recent measurable results, such as strength, study output, or coding milestones.
- **Consistency:** recent adherence over a defined time window.
- **Recovery/readiness:** based on available sleep, energy, and recovery inputs.
- **Trend:** direction of recent performance compared with a prior baseline.

A user can retain a high lifetime level while current consistency or performance is temporarily down.

### 4.2 XP rules

- XP is awarded by the backend, never trusted from the client.
- Every award must reference a validated activity event.
- Use an audit trail and idempotency key to prevent duplicate awards.
- Repeated low-value actions must not be farmable.
- XP values and caps must be configurable and documented.
- Show the reason for every XP award in the history.

Illustrative starting values only; tune after design and testing:
- Focused study session: XP based on validated duration and focus cap.
- Coding session: XP for meaningful focused work.
- Gym session: activity / discipline XP.
- Running session: endurance activity XP.
- Planned task completion: small productivity XP.
- Weekly consistency: capped bonus based on valid planned activity.

### 4.3 Evidence-based skill progression

Examples:
- A gym session may grant activity and discipline XP. Strength progression requires measured improvement in load, reps, estimated performance, or another explicit strength metric.
- A coding session may grant programming activity XP. DSA problem-solving, project milestones, and demonstrated outcomes contribute stronger evidence.
- Study duration contributes learning activity. Assessment results or completed learning milestones can provide outcome evidence.
- Recovery should be based on recovery inputs and trends, not arbitrary rewards.

Do not claim that a skill has objectively improved solely because the user logged more sessions.

---

## 5. Technical architecture

### 5.1 Stack

| Layer | Technology |
|---|---|
| Desktop web | Next.js + TypeScript |
| Native mobile | React Native + Expo + Expo Router |
| Backend API | Python + FastAPI |
| Database | Managed PostgreSQL |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Validation | Pydantic |
| Analytics | Pandas + NumPy |
| Classical ML | Scikit-learn, optional and only where justified |
| Web charts | Recharts |
| API contract | OpenAPI-generated types where practical |
| Testing | Pytest; frontend tests appropriate to each app |

### 5.2 Cloud and hosting direction

Possible initial setup:
- Web: Vercel
- API: Render or equivalent managed Python hosting
- Database: Neon or equivalent managed PostgreSQL
- Progress photos: private S3-compatible object storage

Keep providers replaceable. Do not hardwire business logic to one vendor.

### 5.3 Monorepo layout

```text
LIFEOS/
  apps/
    web/                    # Next.js desktop web app
    mobile/                 # React Native + Expo app
  backend/
    app/
      api/
      core/
      models/
      schemas/
      services/
      repositories/
      analytics/
      progression/
      main.py
    migrations/
    tests/
  packages/
    api-types/
  docs/
    architecture.md
    database.md
    api-contracts.md
    progression-rules.md
    ui-design-system.md
  AGENTS.md
  ARCHITECTURE.md
  PROGRESS.md
  docker-compose.yml
  .env.example
  README.md
```

---

## 6. Database design — initial entities

The final ERD and constraints must be produced during architecture design, after the UI flows clarify data-entry needs.

Initial tables/entities:

- `users`
- `subjects`
- `study_sessions`
- `coding_sessions`
- `coding_milestones`
- `assignments`
- `workout_sessions`
- `exercises`
- `exercise_sets`
- `health_records`
- `daily_logs`
- `tasks`
- `habits`
- `habit_logs`
- `skill_profiles`
- `activity_events`
- `xp_transactions`
- `performance_metrics`
- `goals`
- `goal_progress`
- `achievements`
- `achievement_unlocks`
- `progress_photos`
- `refresh_tokens` or equivalent secure token-session records

Use `user_id` ownership fields where appropriate even though the initial deployment is single-user. Do not introduce public signup, organization tables, tenant routing, or elaborate role systems without a real requirement.

Database requirements:
- Foreign keys and appropriate delete behavior
- Unique constraints and idempotency protection
- Indexes for common date-range and owner queries
- UTC timestamps, local timezone display
- Created / updated timestamps where useful
- Private object-storage references for photos; never public-by-default URLs
- Documented migrations and backup/export strategy

---

## 7. API contract — initial outline

Prefix: `/api/v1`

### Authentication
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

No public registration endpoint.

### Dashboard
- `GET /dashboard/overview`

### Academics
- `POST /study/sessions`
- `GET /study/sessions`
- `GET /study/analytics`
- CRUD endpoints for subjects, assignments, and milestones as required.

### Fitness
- `POST /workouts`
- `POST /workouts/{workout_id}/sets`
- `GET /workouts`
- `GET /fitness/progression`
- Exercise and personal-record endpoints as required.

### Health & productivity
- `POST /health/records`
- `GET /health/summary`
- Task, habit, and daily-log endpoints as required.

### Progression and analytics
- `GET /skills`
- `GET /skills/{skill_id}`
- `GET /progression/history`
- `GET /analytics/weekly`
- `POST /goals`
- `GET /achievements`

Use Pydantic request/response schemas. Validate ownership and input ranges on the server. Keep API contracts documented and versioned.

---

## 8. Security and privacy

- Private personal login; no public registration.
- Argon2 password hashing.
- Short-lived access tokens and rotating refresh tokens.
- Secure, HTTP-only cookies for web sessions where appropriate.
- Secure token storage on mobile; never store secrets in plain app preferences.
- Rate-limit authentication endpoints.
- Validate ownership on every protected resource.
- Private progress-photo storage with short-lived signed access URLs.
- No secrets committed to Git; use environment variables / deployment secrets.
- Backups and user data export.
- Do not log passwords, tokens, or sensitive photo URLs.
- HTTPS in deployed environments.

---

## 9. Offline and synchronization behavior

Mobile should support a local pending-action queue for selected logging actions.

Expected flow:
1. User logs a workout or study session offline.
2. The app stores a pending action locally with a unique client-generated idempotency key.
3. When online, the app sends the action to FastAPI.
4. Backend validates ownership, payload, and idempotency.
5. Backend persists the record and processes associated progression events exactly once.
6. Mobile marks the pending action as synced.
7. Web and mobile fetch the same updated cloud state.

Define conflict behavior explicitly. Do not silently overwrite server records.

---

## 10. Intelligence without paid AI APIs

Core intelligence must work with deterministic Python logic:
- Rules and thresholds
- Rolling averages
- Trend comparisons
- Statistical summaries
- Pandas / NumPy analysis
- Scikit-learn only when enough useful data exists and a model adds measurable value

Optional later: local Ollama model for natural-language summaries. It must be optional and must not block core features.

No required OpenAI, Anthropic, or other paid model API keys. Claude Premium is a development tool only, not a runtime dependency.

Every insight should:
- State what data and time window it used.
- Avoid causal or medical claims without evidence.
- Be explainable and dismissible.
- Avoid presenting weak correlations as certainty.

---

## 11. Development roadmap — UI-first

### Phase 0 — UI/UX design (first)
- Design tokens and component rules
- Desktop navigation and dashboard
- All major desktop module screens
- Mobile navigation and dashboard
- Mobile quick-log flows
- Responsive layouts and interaction states
- Review and approval checkpoint

**Exit condition:** UI direction and core flows approved before implementation.

### Phase 1 — Architecture and data contracts
- ERD and database constraints
- API contracts and OpenAPI review
- Progression formula specification
- Security and sync design
- Technical decisions documented

### Phase 2 — Backend foundation
- FastAPI project structure
- PostgreSQL / SQLAlchemy / Alembic
- Private authentication
- Core schemas and validation
- Tests and migration workflow

### Phase 3 — Desktop web
- Login and app shell
- Dashboard
- Academic, fitness, health, productivity modules
- Skills, goals, and analytics views
- Responsive behavior and UI tests

### Phase 4 — Native mobile
- Expo app and navigation
- Secure authentication
- Dashboard and quick logging
- Workout and study flows
- Offline queue and sync
- Mobile tests and device validation

### Phase 5 — Progression engine
- Activity event pipeline
- XP transactions and idempotency
- Skill levels and attributes
- Evidence-based performance metrics
- Achievements and goals

### Phase 6 — Intelligence and analytics
- Weekly reports
- Trend and plateau detection
- Cross-domain correlations
- Explainable recommendations
- Optional local model experiment

### Phase 7 — Release hardening
- Cloud deployment
- Backups and export
- Security review
- Monitoring and error reporting
- CI/CD
- Android/iOS build and release preparation

---

## 12. Claude / coding-agent operating instructions

Read `ARCHITECTURE.md`, `AGENTS.md`, `docs/ui-design-system.md`, and `PROGRESS.md` before making changes.

1. Work in small, reviewable phases.
2. Start with Phase 0 UI/UX. Do not begin backend implementation until the UI checkpoint is approved.
3. Do not invent product requirements when a decision is missing; document the question and ask.
4. Do not add nutrition, calorie, protein, or meal tracking.
5. Do not add paid AI API dependencies.
6. Keep desktop and mobile behavior consistent while respecting their different interaction patterns.
7. Backend owns XP calculation and progression decisions.
8. Add tests for business logic, validation, authorization, idempotency, and sync.
9. Add or update migrations for every schema change.
10. Never hardcode secrets or commit `.env` files.
11. Do not silently change approved UI or progression rules.
12. Update `PROGRESS.md` after each meaningful task with files changed, tests run, decisions, and next steps.
13. Commit work in coherent milestones and provide a concise review summary.

---

## 13. Definition of done

A feature is complete only when:
- Its UI matches the approved design.
- Its web/mobile behavior is coherent where applicable.
- API validation and authorization are implemented.
- Database constraints and migrations are included.
- Tests cover success, invalid input, and relevant edge cases.
- Loading, empty, and error states exist.
- Documentation and `PROGRESS.md` are updated.
- No paid AI API is required for the feature.
