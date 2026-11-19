# Security and sync design (Phase 1)

> **Status:** proposed for owner review. Implements spec §8 (security and privacy) and §9 (offline and sync).

## 1. Threat model (personal, single owner)

| Asset | Main risks | Primary controls |
|---|---|---|
| Account | Password guessing, stolen tokens | Argon2id, rate limits, short access tokens, rotating refresh tokens with reuse detection |
| Personal data (health, academics, photos) | Leaks through logs, URLs or backups; IDOR | Ownership filter on every query, 404 for foreign IDs, log redaction, private bucket, encrypted backups |
| Progression integrity | Client-forged XP, replayed requests | The server derives all XP; idempotency keys; unique event constraints |
| Mobile device | Lost phone | Tokens in SecureStore (Keychain / Keystore), revoke from web, no secrets in plain storage |

## 2. Authentication

**Account**
- One owner. No registration endpoint (spec §7).
- The account is created by a one-off CLI command (`python -m app.cli create-owner`) that reads the password interactively. It is never stored in env files.

**Password hashing**
- Argon2id via `argon2-cffi`: memory 64 MiB, time cost 3, parallelism 1, 16-byte salt.
- Re-hash on login if the parameters change.
- Minimum length 12. No composition rules; a check against a local list of common passwords is proposed.

**Tokens**

| Token | Format | Lifetime | Storage (web) | Storage (mobile) |
|---|---|---|---|---|
| Access | JWT (EdDSA, `sub`, `iat`, `exp`, `jti`, `aud` = `web` or `mobile`) | 15 min | httpOnly, Secure, SameSite=Lax cookie `lifeos_access`, path `/api` | Memory, plus `expo-secure-store` |
| Refresh | Opaque 256-bit random string; only its SHA-256 is stored | 30 days, sliding | httpOnly, Secure, SameSite=Strict cookie `lifeos_refresh`, path `/api/v1/auth` | `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) |

**Rotation and reuse detection**
- Every refresh marks the old token `used_at` and issues a new one in the same `family_id`.
- Presenting a **used** token revokes the **whole family**: someone copied it. The user must log in again on that device.

**CSRF (web)**
- Cookie auth plus a double-submit `lifeos_csrf` cookie, echoed in an `X-CSRF-Token` header on every mutation.
- SameSite=Lax blocks cross-site POSTs as defence in depth.

**Rate limits**

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 attempts / 15 min per IP + username. Exponential backoff after that; `429` with `Retry-After` |
| `POST /auth/refresh` | 30 / min |
| Everything else | 600 / min per user (abuse guard only) |

**Logout** revokes the family. The web settings page lists active sessions (web or mobile, last used) with "Revoke".

## 3. Authorization and data handling
- **Ownership:**
  - Every repository method takes `user_id` and filters by it.
  - Foreign or missing IDs both return **404**.
  - Tests include a second user created only in tests, to prove isolation.
- **Validation:** Pydantic schemas mirror the OpenAPI bounds, and database `CHECK` constraints repeat the critical ones.
- **Logging:**
  - Structured JSON logs.
  - Never logged: passwords, tokens, cookies, signed URLs, request bodies of auth endpoints, or photo object keys.
  - Request IDs are logged.
  - Health values aren't logged; only counts and timings are.
- **Transport:** HTTPS only in deployed environments. HSTS (1 year) on web and API. CORS allows only the web origin.
- **Security headers (web):** CSP with `default-src 'self'`, `frame-ancestors 'none'`, `Referrer-Policy: same-origin`, `Permissions-Policy` that disables the camera except in the photo-upload flow.
- **Secrets:** only environment variables or deployment secrets. `.env.example` lists the names, never values. `.env*` is git-ignored.

## 4. Progress photos
- **Storage:** a private S3-compatible bucket with no public ACLs and encryption at rest.
- **Upload:** `POST /progress-photos/upload-url` returns a presigned **PUT** valid 5 minutes. It's restricted to the declared content type and ≤ 15 MB. The object key is a random UUID, never a filename or date.
- **Confirm:** the server verifies the object exists (HEAD) before marking `upload_state = stored`.
- **Read:** a presigned **GET** valid 5 minutes, issued per view. URLs are never cached by the client beyond expiry and never logged.
- **Delete:** removes the object and tombstones the row.
- **Photo metadata:** EXIF (including GPS) is stripped on the client before upload; the server re-checks.

## 5. Backups and export
- **Backups:**
  - Provider point-in-time recovery (7 days minimum).
  - A nightly `pg_dump`, encrypted (age / GPG), to separate storage. 30 daily and 12 monthly copies kept.
  - A restore drill each phase, recorded in `PROGRESS.md`.
- **Export:** `POST /export` builds a ZIP with JSON per table, a README of units and fields, and optionally photos. It's downloaded through a 15-minute signed URL and deleted after 24 h.

## 6. Offline sync (mobile)

### 6.1 What can be done offline
Offline: logging study and coding sessions, DSA problems, workouts and sets, the daily check-in, steps, runs, ticking tasks and habits, and creating tasks.

Online only: login, settings, goals, accepting challenges, photo upload, export. These are rare and less time-sensitive.

### 6.2 The pending-action queue
- **Storage:** an SQLite table on the device (`expo-sqlite`): `id`, `idempotency_key`, `method`, `path`, `body`, `if_match`, `created_at`, `attempts`, `state` (`pending` / `sending` / `failed` / `conflict`), `last_error`.
- **Creating an action:** the app generates the entity `id` (UUIDv4) and the `idempotency_key` at **creation** time. Both are stored with the action and reused on every retry.
- **Order:** actions are sent in creation order, one at a time, so a set never arrives before its workout.
- **When it sends:**
  - triggers are app foreground, network regained, and every 60 s while pending items exist;
  - backoff is 2^attempts seconds, maximum 10 minutes.

| Response | Client action |
|---|---|
| 2xx, or an idempotent replay of 2xx | Mark synced; replace the local optimistic copy with the server copy |
| 401 | Refresh the token once and retry; if refresh fails, pause the queue and ask for login (entries stay saved) |
| 409 `version_conflict` | Pause that item and show it in **Profile → Sync** with both versions (see 6.4) |
| 410 `gone` | Discard the action; tell the user the record was deleted on another device |
| 422 | Mark failed, show the validation message, and let the user edit or discard. Never retried automatically |
| 5xx, timeout, offline | Keep pending and back off |

### 6.3 Pulling server state
- `GET /sync/changes?since=<cursor>` returns upserts and tombstones ordered by `change_seq`, in pages.
- The device stores the last cursor. A full resync (`since=0`) happens on first login or after 90 days offline, because tombstones are purged after 90 days.
- After pushing, the app pulls, so web and mobile converge on the same cloud state (spec §9 step 7).

### 6.4 Conflict policy (spec §9: "define conflict behaviour explicitly")

| Situation | Policy |
|---|---|
| Two devices **create** different records | No conflict; both are kept (distinct UUIDs) |
| The same action is **replayed** | Idempotency returns the original result; nothing is duplicated |
| **Daily check-in** for the same date from two devices | Field-level merge on the server **only for fields one side left empty**. If both sides set different values for the same field, the second write gets `409` and the user picks per field |
| **Update** with a stale `If-Match` (task edited on web and phone) | `409` with the server copy. The user sees "Keep mine / Keep server". "Keep mine" re-sends with the new version. Never a silent last-write-wins |
| **Tick / untick** (task complete, habit done) | Treated as an explicit state set, not a toggle (`completed_at` value, `done: true/false`), so replays are safe. A stale version still gets `409` |
| **Update after delete** | `410 gone`; the client drops the change and tells the user |
| **Delete after update** | `409`; the user confirms the delete of the newer version |
| Clock skew | The server orders by its own time and `change_seq`. Client times are trusted only as `started_at` for the activity itself; times more than 5 min in the future are rejected with `422` |

### 6.5 XP and offline
- The phone never shows awarded XP for unsynced entries. It shows "XP is added after sync".
- After sync, the response and the next pull bring the real XP transactions.
- Previews (est. 1RM, readiness) are labelled as previews and computed with the same documented formulas.

## 7. Security tests (Phase 2 and later)
- Auth: wrong password, lockout and backoff, token expiry, refresh rotation, reuse revokes the family, logout revokes.
- Authorization: every endpoint called with user B's IDs returns 404.
- Idempotency: replay returns an identical response; same key with a different body returns 422; concurrent duplicate requests write once (unique constraint).
- Concurrency: stale `If-Match` returns 409 with `current`; update after delete returns 410.
- Validation: boundaries for every bounded field; no XP fields accepted (extra fields are rejected).
- Photos: wrong content type and oversize are rejected; signed URLs expire.
