# Build Roadmap — FieldMA Central Monitor

Execution is structured into 5 incremental, verifiable phases following Phase 0 approval. Each phase ends with passing automated checks and an update to `docs/Memory.md`.

---

## Phase 0 — Planning & Architecture Specifications *(Current — Awaiting Approval)*
- **Deliverables:** `docs/PRD.md`, `docs/Architecture.md`, `docs/Design.md`, `docs/Phases.md`, `docs/Rules.md`, `docs/Memory.md`.
- **Gate:** Explicit user approval before scaffolding any application code.

---

## Phase 1 — Docker Local Dev + Laravel / Inertia v2 / React 19 / Reverb Scaffold
**Goal:** Boot a reproducible local stack with authentication, strict TypeScript/Tailwind/shadcn primitives, Reverb WebSockets, and a local mock remote MySQL server for realistic multi-instance testing.

- **Key Tasks:**
  1. Initialize latest stable Laravel (PHP 8.2+), Inertia.js v2, React 19, TypeScript (`strict: true`), Tailwind CSS, and customized shadcn/ui primitives (Dialog/Sheet, Tooltip, Button, Input, Select, Switch, AlertDialog).
  2. Configure `docker-compose.yml` (`app`, `nginx`, `vite`, `mysql`, `redis`, `worker`, `scheduler`, `reverb`, `mock-remote-db`) with Nginx proxying `/app` to Reverb.
  3. Install and configure Laravel Reverb + Laravel Echo (`pusher-js` client targeting Reverb) and verify private channel auth on `private-fieldma.dashboard`.
  4. Add internal session authentication (login/logout, no public registration) and `role` (`admin` / `viewer`) column on `users` with an initial admin seeder.
  5. Seed `mock-remote-db` with 3 mock FieldMA databases (`fieldma_alpha` full schema, `fieldma_beta` high-activity schema, `fieldma_legacy` missing `site_registration_v2_s` and `device_logs`) for end-to-end verification.
- **Exit Criteria:**
  - `docker compose up -d` boots all services cleanly; login works; React shell renders with zero console errors; Reverb WebSocket connects on `private-fieldma.dashboard`.
  - `npm run typecheck` and `php artisan test` pass.

---

## Phase 2 — Encrypted Instance CRUD Registry + Ephemeral Test Connection
**Goal:** Full management of 40+ FieldMA instances with encrypted credentials and a safe, read-only connection tester.

- **Key Tasks:**
  1. Create `fieldma_instances` migration and `FieldmaInstance` Eloquent model (`db_password` with `encrypted` cast and `$hidden`).
  2. Build `StoreFieldmaInstanceRequest`, `UpdateFieldmaInstanceRequest` (blank `db_password` preserves stored secret), `TestConnectionRequest`, and `FieldmaInstanceResource` (explicitly omitting `db_password`).
  3. Implement `App\Services\RemoteDatabaseConnector`: ephemeral connection config, `PDO::ATTR_TIMEOUT => 3`, `SET SESSION TRANSACTION READ ONLY`, sanitized PDO error classifier (`CONN_TIMEOUT`, `AUTH_FAILED`, `UNKNOWN_DB`, `QUERY_ERROR`), and guaranteed `DB::purge()` + config unset in `finally`.
  4. Implement `App\Services\RemoteSchemaInspector` (`SHOW TABLES` cached in Redis for 6h under `fieldma:tables:{id}`, invalidated on instance update and Test Connection).
  5. Build `FieldmaInstanceController` (`index`, `store`, `update`, `destroy`, `testConnection`) with role gate (`admin` only for mutations).
  6. Build the slide-over Radix Sheet CRUD drawer with inline Test Connection feedback strip and safe delete AlertDialog.
- **Exit Criteria:**
  - Creating, editing (with and without password change), testing, and deleting instances works against `mock-remote-db`.
  - Feature tests verify `db_password` never appears in Inertia props, JSON responses, or logs.

---

## Phase 3 — Single-Query 16-Metric Collector + Parallel Queue Polling
**Goal:** Poll all active instances in parallel every 60 seconds using a single SQL round-trip per database and persist daily snapshots.

- **Key Tasks:**
  1. Create `fieldma_daily_snapshots` migration and `FieldmaDailySnapshot` model with composite unique `(fieldma_instance_id, snapshot_date)` and nullable unsigned integer columns for all 16 metrics.
  2. Implement `App\Services\MetricsCollector`: compiles one parameterized `SELECT /*+ MAX_EXECUTION_TIME(5000) */ ...` query across all 16 metrics using cached `SHOW TABLES`, substituting `NULL` for missing tables and handling `device_logs` vs `mobileusers.fcm_id` fallback and `tada_dealer_expenses` + `tada_other_expenses` partial availability.
  3. Implement `PollFieldmaInstanceJob` (`queue = 'polling'`, `tries = 1`, `timeout = 15`): runs collector, classifies `online` / `degraded` (`>= 1500ms` or missing tables) / `offline`, upserts `fieldma_daily_snapshots`, and handles `42S02` with one schema cache refresh retry.
  4. Register `DispatchFieldmaPolls` in `routes/console.php` (`->everyMinute()->withoutOverlapping(55)`).
  5. Add admin-only manual poll endpoints (`POST /instances/{instance}/poll` and `POST /dashboard/poll-all` with throttle middleware).
- **Exit Criteria:**
  - Running `php artisan fieldma:poll` populates `fieldma_daily_snapshots` for all 3 mock remote DBs; `fieldma_legacy` records `NULL` for missing-table metrics and `status = 'degraded'` without throwing.
  - Unreachable host records `status = 'offline'` within ~3s with `CONN_TIMEOUT`.

---

## Phase 4 — Reverb Broadcasting + Live Single Point Dashboard Table
**Goal:** Deliver the ops-grade 16-metric dashboard with live WebSocket row patching, sticky navigation, dynamic Totals Row, and historical snapshot browsing.

- **Key Tasks:**
  1. Create `FieldmaMetricsUpdated` (`ShouldBroadcastNow` on `private-fieldma.dashboard`, event `.metrics.updated`) and dispatch it from `PollFieldmaInstanceJob` after snapshot upsert.
  2. Build `DashboardController@index` returning Inertia props (`selectedDate`, `today`, `rows`, `canManage`) with strict TypeScript DTOs (`DashboardRow`, `FieldmaMetrics`, `FieldmaMetricsUpdatedPayload`).
  3. Build the Single Point Dashboard UI per `docs/Design.md`:
     - Compact 48px top utility bar (Reverb status dot, date picker + `Today` reset, search input with `/` shortcut, status filter pills with counts, `Poll All`, `+ Add Instance`).
     - 2-tier sticky header with column groups (`Users & Attendance`, `Visits`, `Orders & Finance`, `Field Activity`), sticky left column, `tabular-nums` alignment, and sticky bottom **Totals Summary Row**.
     - Row states (`online`, `degraded`, `offline`), `—` missing-table tooltips, and `600ms` CSS flash strictly on changed cells.
  4. Implement `useFieldmaRealtime` hook: patches only the affected row by `instance_id`, preserves search/sort/scroll/open drawer state, ignores broadcasts when `snapshot_date !== selectedDate`, and triggers Inertia partial reload (`only: ['rows']`) on Echo reconnect.
- **Exit Criteria:**
  - Triggering a poll updates the matching row live in the browser with cell flash, updates the Totals Row, and does not reset scroll position, search text, or an open Edit drawer.
  - Switching to yesterday's date freezes live updates and displays persisted historical snapshots.

---

## Phase 5 — Hardening, Schema-Drift Edge Cases, Security Audit & Production Configs
**Goal:** Verify production readiness under failure modes and deliver native Linux/Nginx/Supervisor deployment configs.

- **Key Tasks:**
  1. Write comprehensive automated test suite (PHPUnit/Pest):
     - Encrypted password non-leakage across HTTP, Inertia, logs, and broadcast payloads.
     - `DB::purge()` verification on both success and thrown `PDOException`.
     - Single-query SQL generation tests for full schema, missing `site_registration_v2_s`, missing `device_logs` (fallback to `fcm_id`), missing one vs. both expense tables, and reserved-word `` `from` `` escaping.
     - Degraded threshold (`>= 1500ms`), offline classification, and historical date snapshot isolation.
  2. Run static analysis & strict checks: `npm run typecheck` (`tsc --noEmit`), `npm run build`, PHPStan/Pint (if installed), and `php artisan test`.
  3. Add production deployment reference configs under `deploy/` (Nginx site config with Reverb WS proxy + Supervisor worker/Reverb unit templates).
  4. Finalize `docs/Memory.md` with verified behavior and operational runbook notes.
- **Exit Criteria:**
  - All backend tests, strict TypeScript checks, and production Vite build pass cleanly with zero warnings or `any` types.
