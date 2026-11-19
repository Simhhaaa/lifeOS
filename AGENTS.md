# Instructions for coding agents

Read before changing anything:
- `LIFEOS_MASTER_SPEC.md`
- `ARCHITECTURE.md`
- `docs/ui-design-system.md`
- `PROGRESS.md`

`apps/web/AGENTS.md` adds rules specific to the web app; Next.js 16 differs from older versions, so read the bundled docs.

## Working rules (from spec §12)
1. Work in small, reviewable phases. Phase 0 (UI/UX) is approved. Phase 1 (architecture and contracts) must be approved before backend code (Phase 2) starts.
2. Don't invent product requirements. When a decision is missing, write the question in `PROGRESS.md` and ask the owner.
3. **No** nutrition, calorie, protein or meal tracking.
4. **No** paid AI API dependencies.
5. Keep desktop and mobile behaviour consistent; respect their different interaction patterns.
6. The **backend owns** XP calculation and every progression decision. Clients never send XP or levels.
7. Add tests for business logic, validation, authorization, idempotency and sync.
8. Add or update an Alembic migration for every schema change.
9. Never hardcode secrets or commit `.env` files.
10. Don't silently change approved UI, API contracts or progression rules. Changes go through `PROGRESS.md` and owner approval.
11. Update `PROGRESS.md` after each meaningful task: files changed, tests run, decisions and next steps.

## Contracts are the source of truth
- **Database:** `docs/database.md` describes every table. Migrations must match it, or the document is updated in the same change.
- **API:** `docs/api/openapi.yaml` is the design-first contract. FastAPI's generated schema must match it; Phase 2 adds a contract test. Client types in `packages/api-types` are generated from it.
- **Progression:** `docs/progression-rules.md` defines every rule. Rule values live in versioned `xp_rules` rows, not in code constants.

## Sample data
The web app currently runs on seeded sample data (`apps/web/src/lib/sample-data.ts`, `lib/sample/*`). It is labelled "Sample data" in the UI and must never be presented as real activity. In Phase 3 it is replaced by API calls; keep it only for Storybook-style previews.
