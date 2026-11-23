# Engineering & Security Rules — FieldMA Central Monitor

Every contribution across all phases must adhere strictly to these standards.

---

## 1. PHP & Laravel Standards
- **Strict Typing:** Include `declare(strict_types=1);` at the top of every PHP file in `app/`, `database/`, and `tests/`. Use explicit parameter types, return types, and PHP 8.2+ `readonly` DTOs and backed enums (`InstanceStatus`, `UserRole`).
- **Idiomatic & Minimal:** Keep architecture direct—Controllers, Form Requests, Eloquent Models, focused Service classes (`RemoteDatabaseConnector`, `RemoteSchemaInspector`, `MetricsCollector`), Jobs, Events, and API Resources. **No unnecessary Repository/Interface boilerplate.**
- **Validation & Serialization:**
  - Validate every incoming HTTP request with a dedicated `FormRequest` class.
  - Serialize every model/DTO sent to Inertia or JSON through an explicit `JsonResource` or typed `toArray()` DTO—never pass raw Eloquent models (`FieldmaInstance::all()`) directly to Inertia props.
- **Zero Dead Code:** No `// TODO` stubs, no commented-out code blocks, no unused imports, and no redundant comments restating obvious code.
- **Date & Timezone Discipline:** Always use half-open UTC/configured-timezone date bounds (`created_at >= :day_start AND created_at < :day_end`) instead of `DATE(created_at) = ?` so remote MySQL indexes remain usable.

---

## 2. React 19 & TypeScript Standards
- **Strict TypeScript:** `"strict": true`, `"noUncheckedIndexedAccess": true` in `tsconfig.json`. **Zero `any`**, zero `@ts-ignore`, and zero unsafe type assertions where type guards belong.
- **Contract Parity:** Maintain a single `resources/js/types/fieldma.ts` module whose interfaces (`FieldmaInstanceItem`, `DashboardRow`, `FieldmaMetrics`, `FieldmaMetricsUpdatedPayload`, `TestConnectionResult`) match backend Resources and Reverb event payloads field-for-field.
- **State Discipline:**
  - Live WebSocket patches must update only the target row by `instance_id` without resetting search input, sort column/direction, table scroll position, or open drawers/dialogs.
  - Derive filtered rows, sorted rows, and the Totals Summary Row via `useMemo`—never duplicate derived totals in separate mutable `useState`.
  - Ignore incoming Reverb updates whenever `payload.snapshot_date !== selectedDate`.
- **Clean Effects:** Always clean up Echo channel listeners and cell-flash timers in `useEffect` return functions to prevent memory leaks on navigation.

---

## 3. Tailwind CSS & shadcn/ui Standards
- **Numeric Stability:** Every numeric table cell, latency readout, count pill, and timestamp MUST include `tabular-nums`.
- **Visual Restraint (Anti-AI Checklist):**
  - Reject any PR containing purple/indigo gradients, glassmorphism (`backdrop-blur`), neon/glow shadows, decorative hero headers, redundant KPI cards above the table, or emojis in UI strings.
  - Use crisp `1px` `zinc-200`/`zinc-800` borders and `rounded-md`/`rounded-sm` radii on customized Radix/shadcn primitives.
  - Semantic colors (`emerald`, `amber`, `rose`) belong strictly on status dots, degraded latency text, offline error indicators, and the 600ms changed-cell flash.

---

## 4. Security & Remote SQL Guardrails
- **Credential Encryption & Zero Leakage:**
  - `FieldmaInstance::$casts = ['db_password' => 'encrypted']` and `protected $hidden = ['db_password']`.
  - Never include `db_password` in `FieldmaInstanceResource`, `FieldmaMetricsUpdated`, Inertia shared props, or `Log::*` calls.
  - Sanitize all `PDOException` / `QueryException` messages before storing in `fieldma_daily_snapshots.error_message` or returning from `test-connection` so host strings, SQL fragments, or credentials can never leak.
- **Read-Only Remote Access:**
  - Every ephemeral remote connection MUST set `PDO::ATTR_TIMEOUT => 3` and `PDO::MYSQL_ATTR_INIT_COMMAND => 'SET SESSION TRANSACTION READ ONLY'`.
  - Every ephemeral remote connection MUST run inside `try { ... } finally { DB::purge($connName); config()->offsetUnset("database.connections.{$connName}"); }`.
  - Never execute `INSERT`, `UPDATE`, `DELETE`, `DDL`, or user-supplied raw SQL against a remote FieldMA database.
- **Identifier Safety:**
  - Escape reserved MySQL column names with backticks (specifically `` `from` `` in `messages`).
  - Only interpolate table names from a strict hardcoded allowlist of the 16 FieldMA tables verified against `SHOW TABLES`.

---

## 5. Git Commit Conventions
Use **Conventional Commits** with concise, imperative subjects:
- `docs: add Phase 0 planning specifications`
- `chore(docker): configure local compose stack with reverb and mock remote db`
- `feat(instances): add encrypted CRUD registry and test connection endpoint`
- `feat(polling): implement single-query 16-metric collector and parallel queue job`
- `feat(dashboard): add live reverb row patching and sticky totals table`
- `test(security): verify credential redaction and DB::purge cleanup`

Keep commits focused per logical unit; never commit `.env`, `APP_KEY` secrets, or `vendor/`/`node_modules/`.

---

## 6. Testing & Verification Requirements
Before marking any phase complete:
1. **Backend:** `php artisan test` passes with feature and unit coverage for all new endpoints, jobs, schema-drift fallbacks, and security invariants.
2. **TypeScript:** `npm run typecheck` (`tsc --noEmit`) passes with zero errors.
3. **Frontend Build:** `npm run build` compiles cleanly with zero unresolved imports or warnings.
4. **Manual Smoke Check:** Verify live updates, offline timeout handling (~3s), and missing-table `—` rendering against `mock-remote-db`.
