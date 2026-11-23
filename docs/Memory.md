# Project Memory & Living State Log — FieldMA Central Monitor

> Living operational record updated at the completion of every build phase. Tracks architectural decisions, FieldMA clone schema quirks, current status, and verified gotchas.

---

## 1. Current Project Status
- **Active Phase:** Phase 5 Complete — Production-Ready Release (All 5 Phases Finished)
- **Repository State:** Full FieldMA Central Monitor platform implemented end-to-end: Laravel 13.43, PHP 8.4+, MySQL 8, Redis, Laravel Reverb + Echo (`pusher-js`), Inertia v2, React 19, strict TypeScript (zero `any`), Tailwind v4, customized Radix/shadcn ops primitives, Docker local dev stack (with `mock-remote-db` and `phpmyadmin`), and native Linux Nginx/Supervisor production templates under `deploy/`.
- **Verification:** `php artisan test` (30 passed, 200 assertions), `./vendor/bin/pint` (63 files clean), `npm run typecheck` (0 errors), `npm run build` (clean bundle), zero `any` in `resources/js/`, and live poll verified against real `FieldMA Demo` (`demo_fieldma`, MySQL 8.0.46, 111 tables).

| Phase | Scope | Status | Completed Date |
| :---: | :--- | :--- | :---: |
| 0 | Planning Docs (`PRD`, `Architecture`, `Design`, `Phases`, `Rules`, `Memory`) | Complete | 2026-11-23 |
| 1 | Docker Local Dev + Laravel / Inertia v2 / React 19 / Reverb Scaffold | Complete | 2026-11-23 |
| 2 | Encrypted Instance CRUD Registry + Ephemeral Test Connection | Complete | 2026-11-23 |
| 3 | Single-Query 16-Metric Collector + Parallel Queue Polling | Complete | 2026-11-23 |
| 4 | Reverb Broadcasting + Live Single Point Dashboard Table | Complete | 2026-11-23 |
| 5 | Hardening, Schema-Drift Fallbacks, Security Audit & Tests | Complete | 2026-11-23 |

---

## 2. Key Architectural Decisions
1. **Single SQL Round-Trip per Remote DB:** All 16 metrics execute as scalar subqueries inside one `SELECT` statement using positional `?` bindings (avoiding native MySQL prepared-statement duplicate named-parameter errors when `PDO::ATTR_EMULATE_PREPARES => false`).
2. **`NULL` vs `0` Semantics:** `fieldma_daily_snapshots` stores all 16 metrics as `INT UNSIGNED NULL`. `NULL` strictly means the source table is missing on that clone (rendered as `—` with tooltip); `0` means the table exists and had zero matching rows.
3. **Sargable Date Bounds:** All daily queries filter with `created_at >= ? AND created_at < ?` rather than `DATE(created_at) = ?` so remote `created_at` indexes are utilized.
4. **Direct Worker-to-Reverb Broadcast:** `FieldmaMetricsUpdated` implements `ShouldBroadcastNow` so updates reach the browser immediately from `PollFieldmaInstanceJob` without a second queue hop.
5. **No Job Retries Inside 60s Window:** `PollFieldmaInstanceJob` uses `tries = 1` and `timeout = 15`. Because the scheduler re-dispatches every 60 seconds, retrying dead hosts inside the same minute only clogs workers.
6. **Docker for Local Dev Only:** `docker-compose.yml` includes `mock-remote-db` (hosting modern + legacy FieldMA schemas) and `phpmyadmin` (`:8082`) for local development; production deploys natively on Linux/Nginx/PHP-FPM/Supervisor (`deploy/`).
7. **Offline-Safe Vite Builds:** Removed `laravel-vite-plugin/fonts` Bunny CDN build-time fetch so `npm run build` succeeds in air-gapped or offline CI environments without network access.

---

## 3. Known Schema Quirks Across FieldMA Clones
Record every real-world schema variation discovered across the 40+ FieldMA deployments here:

| Table / Column | Quirk / Variation | Implemented Handling |
| :--- | :--- | :--- |
| `messages.from` | `from` is a MySQL reserved keyword. | Always quote as `` `from` `` in `COUNT(DISTINCT `from`)`. |
| `device_logs.mobileuser_id` vs `mobileusers.fcm_id` | Real FieldMA `device_logs` uses `mobileuser_id` (not `user_id`), and older clones lack `device_logs` entirely. | Check cached `SHOW TABLES`: use `COUNT(DISTINCT mobileuser_id) FROM device_logs` if present; otherwise fall back to `mobileusers` where `fcm_id IS NOT NULL AND fcm_id <> ''`. |
| `tada_entries.deleted_at` | Soft-deleted daily reports must be excluded. | Filter `WHERE deleted_at IS NULL` in Metric #10. |
| `tada_dealer_expenses` & `tada_other_expenses` | Expense entries span two tables; older clones may only have one. | Sum `COALESCE` of whichever table(s) exist in cached `SHOW TABLES`; return `NULL` only if both are absent. |
| `v2_site_registrations` vs `site_registration_v2_s` | Real FieldMA deployments (e.g., `demo_fieldma`) use `v2_site_registrations` (with `deleted_at`); some clones use `site_registration_v2_s` or omit both. | Prefer `v2_site_registrations` (`deleted_at IS NULL`), fall back to `site_registration_v2_s`, else emit `NULL`. |
| `visits.status` | Case inconsistency (`Online`, `ONLINE`, `online`) across clones. | Normalize with `LOWER(status) = 'online' | 'offline' | 'unlisted'`. |

---

## 4. Known Gotchas & Operational Notes
- **Native MySQL Prepared Statements & Repeated Named Params:** With `PDO::ATTR_EMULATE_PREPARES => false`, MySQL rejects repeating `:day_start` in one query. `MetricsCollector::compileQuery()` uses positional `?` placeholders with an ordered `$bindings` list.
- **Laravel `config()->offsetUnset()` Does Not Delete Nested Keys:** `Illuminate\Config\Repository::offsetUnset()` sets a dot-notated key to `null` rather than unsetting it. `RemoteDatabaseConnector::run()` explicitly unsets `$connections[$connectionName]` and rewrites `database.connections` in `finally` alongside `DB::purge()` so long-running queue workers never leak config keys.
- **PHP 8.4+ Runtime Requirement:** Composer resolved Symfony 8.1 / Laravel 13 dependencies requiring `PHP >= 8.4.1`; `docker/php/Dockerfile` uses `php:8.4-fpm-alpine`. `RemoteDatabaseConnector` prefers `\Pdo\Mysql::ATTR_INIT_COMMAND` with `PDO::MYSQL_ATTR_INIT_COMMAND` fallback for PHP 8.4+ compatibility.
- **TypeScript 7 `tsconfig.json`:** `baseUrl` was removed in TypeScript 7; `paths` must use relative `./resources/js/*` entries.
- **Vite 8 ESM Config:** Use `import.meta.dirname` instead of `__dirname` in `vite.config.ts`.
- **Historical View Integrity:** Live Reverb events always carry `snapshot_date`. `useFieldmaRealtime` checks `payload.snapshot_date === selectedDateRef.current` before patching state so historical date views are never overwritten by today's live polls.
- **Reverb Proxy Timeouts:** Nginx reverse-proxying `/app` to Reverb must configure `proxy_http_version 1.1`, `Upgrade`/`Connection` headers, and `proxy_read_timeout 60s` to prevent premature WebSocket drops.
- **Strict Mode on Legacy MySQL:** Older FieldMA clones may run MySQL 5.7 or MariaDB with varying SQL modes; dynamic remote connections explicitly set `'strict' => false`.
- **Restart Workers After Deploy:** Always run `php artisan queue:restart` (or `docker compose restart worker` locally) after deploying code changes so long-running queue workers reload updated PHP classes.
