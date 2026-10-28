# Personal Vocabulary Implementation Plan

> For agentic workers: execute inline using executing-plans. User authorized starting work directly on 2026-10-28; preserve GitHub checkpoints near 3% quota remaining.

Goal: deliver the phone-first local learning loop and prepare genuine private cloud synchronization.
Architecture: React UI; pure scheduler/content seams; transactional IndexedDB event store; optional Supabase adapter. Never claim an unconfigured cloud connection works.
Tech Stack: React, TypeScript, Vite, Dexie, ts-fsrs, Vitest, Supabase.
Spec: ../specs/2026-10-28-personal-vocabulary-design.md

## Global constraints
15—30 minutes; CET6 and postgraduate primary, IELTS supplemental; distinct knowledge points and abilities; durable offline reviews; no secrets in Git; public deployment outside current scope.

## Review focus
- Duplicate submission and restore: one event must count once.
- Invalid imported file: existing data must survive.
- Reload after starting today's session: no fresh new-word allocation.
- Expired login and network loss: local reviews remain available.
- Same spelling/new sense: progress must remain independent.

## Files and tasks

### 1. Learning domain and persistence
Files: src/model.ts, src/scheduler.ts, src/store.ts, tests/domain.test.ts, tests/store.test.ts.
Interfaces: makeQueue(points,events,day,budget), deriveCard(events), saveReview(event), restoreBackup(value).
- [x] Configure npm scripts (`test`: vitest run; `build`: tsc -b && vite build).
- [x] Write public-behavior tests: same ID twice yields one review; backlog suppresses new points; bad backup leaves old records; restore twice is idempotent.
- [x] Run `npm test` and observe failures before implementation.
- [x] Implement pure event replay with fixed FSRS parameters; Dexie transactions persist reviews atomically.
- [x] Run `npm test` and `npm run build`; commit verified slice.

### 2. Mobile learning experience
Files: src/App.tsx, src/styles.css, src/demo.ts, index.html, public/manifest.webmanifest, public/sw.js.
- [x] Implement today, reveal/rate, budget, vocabulary search/filter, weak points, export/restore.
- [x] Use original demonstration definitions and examples; label demo coverage explicitly.
- [x] Add mobile install metadata and offline shell caching only in production.
- [x] Browser-check 390px viewport, review persistence after reload, search, backup, and error messages.
- [x] Commit after build and behavior checks.

### 3. Cloud integration
Files: src/cloud.ts, supabase/migrations/001_events.sql, .env.example, tests/sync.test.ts.
- [x] Implement account-scoped immutable review uploads with unique event IDs and row-level security.
- [x] Test network failure preserves pending events and retries are idempotent.
- [x] Document environment setup and explicitly distinguish simulated tests from real dual-device acceptance.
- [ ] Real account/environment initialization requires available user-configured service; user confirmed no project yet. Keep status unconfigured.

### 4. Delivery
Files: README.md, docs/PROGRESS.md, .github/workflows/check.yml.
- [x] Run tests, production build, browser checks and secret scan.
- [x] Fresh branch review completed; four meaningful findings reproduced and fixed with regression checks.
- [x] Record exact verification and remaining acceptance items.
- [x] Push code and handoff context; verify remote SHA matches local branch.

Ruling: private GitHub checkpoint requested, so retain the existing checkout on a new codex branch rather than creating hosting infrastructure. No parallel implementers. Quota is observed between milestones, not artificially consumed.
