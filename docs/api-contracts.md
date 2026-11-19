# API contracts (Phase 1)

> Status: **proposed for owner review.** The machine-readable contract is [`docs/api/openapi.yaml`](api/openapi.yaml) (OpenAPI 3.1, 59 operations). This page explains the conventions and maps screens to endpoints.

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1`. Breaking changes require `/api/v2`; additive changes don't. |
| Auth | Web: httpOnly cookies plus an `X-CSRF-Token` header on mutations. Mobile: `Authorization: Bearer`. See [security-and-sync.md](security-and-sync.md). |
| Idempotency | **Every** mutation (POST, PUT, PATCH, DELETE), except login, refresh and logout, requires `Idempotency-Key` (16–128 chars, UUID recommended).<br>A replay with the same key and body returns the stored response; the same key with a different body returns `422 idempotency_mismatch`.<br>Keys are kept 30 days. |
| Concurrency | Editable records return `version`. Updates and deletes send `If-Match: <version>`. A mismatch returns `409 version_conflict` with `current` (the server copy). The server never overwrites silently. |
| Deleted elsewhere | Updating a tombstoned record returns `410 gone`. |
| Client IDs | Offline-creatable resources (study and coding sessions, workouts, sets, cardio, tasks, DSA problems) accept a client-generated `id` (UUID), so children can reference parents created offline. |
| Times | `date-time` is UTC (RFC 3339). Day fields are `date` in the owner's local timezone. The server computes `local_date` from `users.timezone`. |
| Units | kg, km, minutes (sessions), hours (sleep), seconds (cardio duration). |
| Errors | `application/problem+json` (RFC 9457) with a stable `code`: `validation_error`, `version_conflict`, `idempotency_mismatch`, `duplicate`, `not_found`, `gone`, `rate_limited`, `unauthorized`. |
| Pagination | `?cursor=&limit=` (max 200) → `{ items, next_cursor }`. The XP history pages by whole days. |
| Ownership | Every query filters by the authenticated `user_id`. Other users' records return **404**, never 403, so their existence isn't revealed. |
| Derived values | XP, levels, form, attributes, readiness, projections and correlations are **response-only**. They never appear in request schemas. |

## 2. Screen → endpoint map

| Screen | Read | Write |
|---|---|---|
| Overview | `GET /dashboard/overview` | `PATCH /tasks/{id}` (tick) · `POST /insights/{key}/dismiss` |
| Academics | `GET /study/analytics` · `/subjects` · `/assignments` · `/semesters` | `POST /study/sessions` · `/coding/sessions` · `/dsa/problems` · `/milestones` · `/assignments`; `PATCH /assignments/{id}` · `/subjects/{id}` |
| Fitness | `GET /fitness/progression` · `/workouts` · `/exercises` | `POST /workouts` · `/workouts/{id}/sets` · `/workouts/{id}/finish` · `/body-measurements` · `/progress-photos/upload-url` |
| Health & Recovery | `GET /health/summary` · `/daily-logs/{date}` | `PUT /daily-logs/{date}` · `POST /health/records` · `/cardio/sessions` |
| Productivity | `GET /productivity/summary` · `/tasks` · `/habits` | `POST /tasks`; `PATCH /tasks/{id}`; `PUT /habits/{id}/logs/{date}` · `/screen-time/{date}` |
| Skills & attributes | `GET /skills` · `/skills/{key}` · `/attributes` · `/progression/history` · `/xp-rules` | none (derived only) |
| Goals & quests | `GET /goals` · `/quests` · `/challenges` · `/achievements` | `POST /goals` · `/challenges/{key}/accept` |
| Analytics | `GET /analytics/weekly?period=week\|month` · `/analytics/patterns` · `/insights` | `POST /insights/{key}/dismiss` |
| Mobile: Home / Log / Progress / Profile | Same reads as above, plus `GET /sync/changes?since=` | Same writes, sent from the offline queue with stored `Idempotency-Key`s |
| Settings | `GET /settings` | `PATCH /settings` · `POST /export` |

## 3. What one write does (example: finishing a workout)

```text
POST /workouts/{id}/finish   Idempotency-Key: 7f3c…   If-Match: 3
  → validate ownership and version
  → set ended_at, version = 4
  → emit activity_event workout.completed (unique per workout)
  → for each tracked lift whose top-set est. 1RM beats the previous best: emit lift.e1rm_pr
  → progression engine: xp_rules → xp_transactions (unique per event + rule) → skill caches
  → store the idempotency record (key, request hash, response)
  ← 200 Workout (pr: true)                                        all in one DB transaction
```

A replay of the same request returns the same `200` body and writes nothing.

## 4. Contract testing (Phase 2)
- A pytest test loads FastAPI's `app.openapi()` and diffs paths, methods, parameters and schema names against `docs/api/openapi.yaml`. Any difference fails CI until the document or the code changes, with owner approval for breaking changes.
- `packages/api-types` generates TypeScript types with `openapi-typescript`, used by web and mobile.
