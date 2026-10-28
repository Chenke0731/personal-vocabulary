# Private metadata synchronization implementation

Spec: existing personal-vocabulary design sections 7–10. User authorized continued implementation.

Scope: personal points, favorite add/remove, budget and daily allocations. Assessment and active-time counters stay local in this slice.

- [x] Add IndexedDB v2 immutable metadata-change outbox; save settings and corresponding changes atomically.
- [x] Test two independent device databases against a shared transport: concurrent points, favorite removal, budget order, allocations union, failed upload, edits during upload, retry deduplication.
- [x] Add per-account immutable metadata table and RLS migration. Do not create a real service.
- [x] Wire settings/import/editor/restore paths and foreground cloud synchronization; preserve live changes while requests run.
- [x] Include metadata history in portable backups, validate before restore, maintain version1 compatibility.
- [x] Run unit/build/browser tests; fresh bounded review; update README/PROGRESS; push and verify GitHub commit.

Rules: remote sequence decides conflicting point edits/budget/favorites; allocation sets union. Different points survive. Unsent concurrent local edits remain pending and visible. Received rows cannot change existing immutable IDs. Account binding and secrets remain local.

Review: independent bounded review found delayed overwrite from restored pending budget/favorite operations; fixed with regressions covering restore followed by cloud exchange.

Verification: 57 logic/database tests, production build, and affected browser suite. Hosted Supabase remains unconfigured by user choice.
