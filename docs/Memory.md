# Project Memory & Living State Log — FieldMA Central Monitor

> Living operational record updated at the completion of every build phase. Tracks architectural decisions, FieldMA clone schema quirks, current status, and verified gotchas.

---

## 1. Current Project Status
- **Active Phase:** Phase 1 Complete — Ready for Phase 2 (Encrypted Instance CRUD Registry + Ephemeral Test Connection)
- **Repository State:** Laravel 13.43, Inertia Laravel 3.7, Laravel Reverb 1.14, React 19.3, Inertia React 2.3, TypeScript 7 (strict), Tailwind v4, Vite 8, Radix UI ops primitives, internal session auth (`admin`/`viewer`), Reverb channel auth (`private-fieldma.dashboard`), and Docker local dev stack (`docker-compose.yml` + `mock-remote-db`).
- **Verification:** `php artisan test` (8 passed, 22 assertions), `npm run typecheck` (0 errors), `npm run build` (clean production bundle).

| Phase | Scope | Status | Completed Date |
| :---: | :--- | :--- | :---: |
| 0 | Planning Docs (`PRD`, `Architecture`, `Design`, `Phases`, `Rules`, `Memory`) | Complete | 2026-11-23 |
| 1 | Docker Local Dev + Laravel / Inertia v2 / React 19 / Reverb Scaffold | Complete | 2026-11-23 |
| 2 | Encrypted Instance CRUD Registry + Ephemeral Test Connection | Pending | — |
| 3 | Single-Query 16-Metric Collector + Parallel Queue Polling | Pending | — |
| 4 | Reverb Broadcasting + Live Single Point Dashboard Table | Pending | — |
| 5 | Hardening, Schema-Drift Fallbacks, Security Audit & Tests | Pending | — |

---

## 2. Key Architectural Decisions
1. **Single SQL Round-Trip per Remote DB:** All 16 metrics execute as scalar subqueries inside one `SELECT` statement to minimize TCP/TLS handshake overhead across 40+ remote hosts.
2. **`NULL` vs `0` Semantics:** `fieldma_daily_snapshots` stores all 16 metrics as `INT UNSIGNED NULL`. `NULL` strictly means the source table is missing on that clone (rendered as `—` with tooltip); `0` means the table exists and had zero matching rows.
3. **Sargable Date Bounds:** All daily queries filter with `created_at >= :day_start AND created_at < :day_end` rather than `DATE(created_at) = ?` so remote `created_at` indexes are utilized.
4. **Direct Worker-to-Reverb Broadcast:** `FieldmaMetricsUpdated` implements `ShouldBroadcastNow` so updates reach the browser immediately from `PollFieldmaInstanceJob` without a second queue hop.
5. **No Job Retries Inside 60s Window:** `PollFieldmaInstanceJob` uses `tries = 1` and `timeout = 15`. Because the scheduler re-dispatches every 60 seconds, retrying dead hosts inside the same minute only clogs workers.
6. **Docker for Local Dev Only:** `docker-compose.yml` includes a `mock-remote-db` service (hosting modern + legacy FieldMA schemas) for realistic local testing; production deploys natively on Linux/Nginx/PHP-FPM/Supervisor.
7. **Offline-Safe Vite Builds:** Removed `laravel-vite-plugin/fonts` Bunny CDN build-time fetch so `npm run build` succeeds in air-gapped or offline CI environments without network access.

---

## 3. Known Schema Quirks Across FieldMA Clones
Record every real-world schema variation discovered across the 40+ FieldMA deployments here:

| Table / Column | Quirk / Variation | Implemented Handling |
| :--- | :--- | :--- |
| `messages.from` | `from` is a MySQL reserved keyword. | Always quote as `` `from` `` in `COUNT(DISTINCT `from`)`. |
| `device_logs` vs `mobileusers.fcm_id` | Older clones lack `device_logs` and track active logins via `mobileusers.fcm_id IS NOT NULL`. | Check cached `SHOW TABLES`: use `device_logs` distinct `user_id` for the target date if present; otherwise fall back to `mobileusers` where `fcm_id IS NOT NULL AND fcm_id <> ''`. |
| `tada_entries.deleted_at` | Soft-deleted daily reports must be excluded. | Filter `WHERE deleted_at IS NULL` in Metric #10. |
| `tada_dealer_expenses` & `tada_other_expenses` | Expense entries span two tables; older clones may only have one. | Sum `COALESCE` of whichever table(s) exist in cached `SHOW TABLES`; return `NULL` only if both are absent. |
| `site_registration_v2_s` | Newer v2 table absent on legacy clones. | Cached `SHOW TABLES` omits subquery and emits `NULL`, marking instance `degraded` with missing-table tooltip instead of failing the whole poll. |
| `visits.status` | Case inconsistency (`Online`, `ONLINE`, `online`) across clones. | Normalize with `LOWER(status) = 'online' | 'offline' | 'unlisted'`. |

---

## 4. Known Gotchas & Operational Notes
- **PHP 8.4+ Runtime Requirement:** Composer resolved Symfony 8.1 / Laravel 13 dependencies requiring `PHP >= 8.4.1`; `docker/php/Dockerfile` uses `php:8.4-fpm-alpine`.
- **TypeScript 7 `tsconfig.json`:** `baseUrl` was removed in TypeScript 7; `paths` must use relative `./resources/js/*` entries.
- **Vite 8 ESM Config:** Use `import.meta.dirname` instead of `__dirname` in `vite.config.ts`.
- **Local Docker Daemon:** Docker CLI was not present in the local macOS shell PATH during Phase 1; `docker-compose.yml`, `docker/php/Dockerfile`, `docker/nginx/default.conf`, and `docker/mock-remote-db/init.sql` are ready to run once Docker Desktop / OrbStack / Colima is started.
- **Connection Leak Risk:** Long-running `queue:work` processes retain PDO handles unless `DB::purge($connectionName)` and `config()->offsetUnset(...)` execute in a `finally` block on every probe.
- **Historical View Integrity:** Live Reverb events always carry `snapshot_date`. The React dashboard must check `payload.snapshot_date === selectedDate` before patching state so historical date views are never overwritten by today's live polls.
- **Reverb Proxy Timeouts:** Nginx reverse-proxying `/app` to Reverb must configure `proxy_http_version 1.1`, `Upgrade`/`Connection` headers, and `proxy_read_timeout 60s` to prevent premature WebSocket drops.
- **Strict Mode on Legacy MySQL:** Older FieldMA clones may run MySQL 5.7 or MariaDB with varying SQL modes; dynamic remote connections explicitly set `'strict' => false`.
