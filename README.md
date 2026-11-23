# FieldMA Central Monitor

Single-point internal operations hub and encrypted instance registry for monitoring **40+ independent FieldMA Laravel/MySQL deployments** in real time.

Polls remote FieldMA databases in parallel on a 60-second cadence using a single read-only SQL round-trip per deployment, persists daily historical snapshots in a central MySQL 8 database, and streams row-level updates over native Laravel Reverb WebSockets to a high-density Light/Dark ops table—without resetting search, sort, scroll position, or open dialogs.

---

## Architecture Overview

```text
Browser (React 19 + Inertia v2 + Echo/pusher-js)
   |  HTTPS (Inertia)          | WSS (/app/* -> Reverb)
   v                           v
Nginx Reverse Proxy (dynamic DNS resolver in Docker; native TLS in prod)
   +-- PHP 8.4-FPM (Laravel 13) --> Central MySQL 8 (registry + daily snapshots)
   +-- Laravel Reverb (:8080)   <-- BroadcastNow (private-fieldma.dashboard)
   +-- Redis 7 (queues, 6h SHOW TABLES schema cache, Reverb pub/sub)
          |
          v
   Parallel Polling Workers (queue: polling, tries=1, timeout=15s)
          |  Ephemeral PDO (timeout=3s, READ ONLY, DB::purge() in finally)
          v
   [FieldMA DB #1]  [FieldMA DB #2]  ...  [FieldMA DB #40+]
```

### Core Capabilities
- **Encrypted Instance Registry:** Manages `name`, `slug`, `app_url`, `db_ip`, `db_port`, `db_database`, `db_user`, `db_password` (Laravel `encrypted` cast, `$hidden`, never serialized to frontend, logs, or WebSockets), `is_active`, and `notes`. Supports streamlined onboarding where host, port, and credentials default from `.env` (`FIELDMA_DEFAULT_*`).
- **Ephemeral Connection Tester:** Tests unsaved drafts or existing instances with `PDO::ATTR_TIMEOUT => 3`, `SET SESSION TRANSACTION READ ONLY`, `SHOW TABLES` schema inspection, and guaranteed `DB::purge()` plus runtime config cleanup in `finally`.
- **Single-Query 16-Metric Collector:** Compiles all 16 metrics into one parameterized `SELECT` query with `MAX_EXECUTION_TIME(5000)` using positional `?` bindings and sargable half-open date ranges (`created_at >= ? AND created_at < ?`).
- **Schema-Drift Resilience:** Caches `SHOW TABLES` per instance in Redis for 6 hours (with automatic single-retry refresh on SQLSTATE `42S02`). Missing tables on older clones return `NULL` (`—` with tooltip) instead of failing the poll.
- **Real-Time Ops Dashboard:** 2-tier sticky column-group headers, sticky left identity column, `tabular-nums` alignment, dynamic sticky Totals Summary Row, 600ms changed-cell flash, Light/Dark mode with zero-flash persistence, Comfortable/Compact density toggle, and historical date mode that ignores live pushes.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Laravel 13, PHP 8.4+, MySQL 8.4, Redis 7 |
| **Frontend** | Inertia.js v2, React 19, TypeScript (strict, zero `any`), Tailwind CSS v4, Radix UI primitives |
| **Real-Time** | Laravel Reverb + Laravel Echo (`pusher-js` client) |
| **Background Jobs** | Laravel Queues (`redis` driver, dedicated `polling` queue) + Scheduler (`everyMinute`) |
| **Local Dev** | Docker & `docker-compose.yml` (includes `mock-remote-db` & `phpmyadmin`) |
| **Production** | Native Linux, Nginx, PHP 8.4-FPM, Supervisor, Cron |

---

## The 16 Tracked Metrics

All 16 metrics execute in **one SQL round-trip** per remote database against the selected date (`[YYYY-MM-DD 00:00:00, next_day 00:00:00)`):

| Group | # | Metric | Source Table(s) & Schema-Drift Handling |
| :--- | :-: | :--- | :--- |
| **Users & Attendance** | 1 | Users | `mobileusers` (`COUNT(*)`) |
| | 2 | Logins | `device_logs` (`COUNT(DISTINCT mobileuser_id)`), falls back to `mobileusers.fcm_id IS NOT NULL` on older clones |
| | 3 | Check-In | `attendance_statuses` (`COUNT(DISTINCT mobileuser_id)` where `status = 'checkin'`) |
| | 4 | Check-Out | `attendance_statuses` (`COUNT(DISTINCT mobileuser_id)` where `status = 'checkout'`) |
| **Visits** | 5 | Online Visits | `visits` (`LOWER(status) = 'online'`) |
| | 6 | Offline Visits | `visits` (`LOWER(status) = 'offline'`) |
| | 7 | Unlisted Visits | `visits` (`LOWER(status) = 'unlisted'`) |
| | 8 | Scheduled (1/user) | `schedulevisits` (`COUNT(DISTINCT user_id)`) |
| **Orders & Finance** | 9 | Orders | `orders` (`COUNT(*)`) |
| | 10 | Collections | `payments` (`COUNT(*)`) |
| | 11 | Daily Reports | `tada_entries` (`deleted_at IS NULL`) |
| | 12 | Expenses | `tada_dealer_expenses` + `tada_other_expenses` (sums whichever exist; `NULL` only if both absent) |
| **Field Activity** | 13 | GPS Tracked (1/user) | `locations` (`COUNT(DISTINCT user_id)`) |
| | 14 | Messages (1/user) | `messages` (``COUNT(DISTINCT `from`)`` — reserved keyword backtick-escaped) |
| | 15 | Site Registrations | `v2_site_registrations` (`deleted_at IS NULL`), falls back to `site_registration_v2_s`, else `NULL` |
| | 16 | Notices | `notices` (`COUNT(*)`) |

**Status Classification:**
- **Online (Emerald):** Query succeeds, latency `< 1500ms`, zero missing required tables.
- **Degraded (Amber):** Query succeeds, but latency `>= 1500ms` or one or more expected tables are missing.
- **Offline (Rose):** Connection timeout (`CONN_TIMEOUT`), auth error (`AUTH_FAILED`), unreachable host (`HOST_UNREACHABLE`), unknown schema (`UNKNOWN_DB`), permission error (`PERMISSION_DENIED`), or column mismatch (`SCHEMA_COLUMN_ERROR`).

---

## Local Development Quickstart (Docker)

### 1. Environment Setup
Copy `.env.example` to `.env` and configure the default remote FieldMA server values (used automatically when adding instances with just Name, Slug, App URL, and Database Name):
```env
FIELDMA_DEFAULT_APP_URL=https://fieldma.com
FIELDMA_DEFAULT_DB_HOST=<remote-mysql-host>
FIELDMA_DEFAULT_DB_PORT=3306
FIELDMA_DEFAULT_DB_USERNAME=<readonly-db-user>
FIELDMA_DEFAULT_DB_PASSWORD=<readonly-db-password>
```

### 2. Boot the Stack & Initialize Database
```bash
docker compose build
docker compose up -d
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

### 3. (Optional) Seed Local Mock FieldMA Instances
Seeds 3 deployments (`fieldma_alpha`, `fieldma_beta`, and `fieldma_legacy` missing optional tables) pointing at `mock-remote-db`:
```bash
docker compose exec app php artisan db:seed --class=MockFieldmaInstancesSeeder
docker compose exec app php artisan fieldma:poll --sync
```

### Local Service Endpoints

| Service | Address | Notes |
| :--- | :--- | :--- |
| **Central Monitor UI** | `http://localhost:8080` | Seeded accounts in `database/seeders/DatabaseSeeder.php` (`admin@fieldma.local`, `viewer@fieldma.local`) |
| **phpMyAdmin** | `http://localhost:8082` | Server dropdown switches between `mysql` and `mock-remote-db` (see `docker-compose.yml` for local credentials) |
| **Central MySQL 8** | `localhost:33061` | Database `fieldma_central` |
| **Mock Remote MySQL 8** | `localhost:33062` | Databases `fieldma_alpha`, `fieldma_beta`, `fieldma_legacy` |
| **Redis 7** | `localhost:63791` | Queues, 6h schema cache, Reverb pub/sub |
| **Vite HMR** | `http://localhost:5173` | Auto-connected by Laravel Vite |

> **Security Note:** Rotate seeded credentials immediately outside local development. Public user registration is intentionally disabled.

---

## Operational CLI Commands

```bash
# Dispatch parallel poll jobs for all active instances (today)
php artisan fieldma:poll

# Poll synchronously (useful for debugging or immediate backfill)
php artisan fieldma:poll --sync

# Poll a single instance by ID or slug
php artisan fieldma:poll --instance=fieldma-demo --sync

# Backfill snapshots for a historical date
php artisan fieldma:poll --date=2026-11-22

# Restart long-running workers after code or .env changes
php artisan queue:restart
```

---

## Security & Read-Only Guardrails

1. **Encryption at Rest:** `fieldma_instances.db_password` uses Laravel's `encrypted` cast and `$hidden`. `RemoteDbCredentials::__debugInfo()` redacts `dbPassword`.
2. **Zero Leakage:** `FieldmaInstanceResource`, `DashboardRowResource`, `FieldmaMetricsUpdated` broadcast payloads, and sanitized PDO error responses strictly exclude credentials and raw SQL.
3. **Defense-in-Depth Read-Only Access:**
   - Every runtime connection sets `PDO::ATTR_TIMEOUT => 3` and `SET SESSION TRANSACTION READ ONLY`.
   - Every probe executes inside `try { ... } finally { DB::purge($connName); ... }` and unsets the runtime connection key from `database.connections` so long-running queue workers never leak PDO handles or memory.
   - Provision dedicated `SELECT`-only MySQL accounts on every remote FieldMA server restricted to your Central Monitor server IP or WireGuard subnet (see [`deploy/README.md`](deploy/README.md)).

---

## Production Deployment (Native Linux / Nginx / Supervisor)

Production deploys natively without Docker. Full runbook and templates live in [`deploy/README.md`](deploy/README.md):

1. **Build & Optimize:** Run `composer install --no-dev --optimize-autoloader`, `npm ci && npm run build`, `php artisan migrate --force`, and cache config/routes/views.
2. **Nginx:** Use [`docker/nginx/default.conf`](docker/nginx/default.conf) as the base template, pointing `fastcgi_pass` to your PHP 8.4-FPM socket, `/app` and `/apps` to local Reverb (`:8080`) with `proxy_read_timeout 60s`, and terminating HTTPS via Certbot.
3. **Supervisor:** Install [`deploy/supervisor/fieldma-monitor.conf`](deploy/supervisor/fieldma-monitor.conf) to run **10 parallel `polling` queue workers** and the **Laravel Reverb daemon**.
4. **Scheduler Cron:** Configure a 1-minute cron entry invoking `php artisan schedule:run` (see [`deploy/README.md`](deploy/README.md)).
5. **Post-Deploy Reload:** Run `php artisan queue:restart` and reload Reverb after every deploy so long-running daemons pick up updated PHP classes.

---

## Testing & Quality Gates

```bash
php artisan test           # 30 PHPUnit feature/unit tests (200 assertions)
./vendor/bin/pint --test   # Laravel code-style check
npm run typecheck          # Strict TypeScript check (zero `any`)
npm run build              # Production Vite asset bundle
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Top-left Reverb badge shows **Offline** (`502 Bad Gateway` on `/app/*`) | `reverb` container rebuilt with a new IP while Nginx cached the old IP | Restart Nginx (`docker compose restart nginx`). `docker/nginx/default.conf` uses Docker's dynamic DNS resolver to prevent recurrence. |
| Worker ignores recent PHP code or `.env` changes | Long-running `queue:work` daemon holds classes and env in memory | Run `docker compose restart app worker` (or `php artisan queue:restart` in prod). |
| Instance shows **Degraded** (`schema (N)`) | One or more expected tables are missing on that clone | Hover the status dot or `—` cell to inspect the missing table name(s). If a table was recently added remotely, click **Edit -> Save** or **Test Connection** to flush the 6h Redis schema cache. |
| Mock DB instances show `SCHEMA_COLUMN_ERROR` | Existing `mock-remote-db` container initialized from an older `init.sql` | Recreate the mock DB container cleanly (`docker compose up -d --force-recreate mock-remote-db`). |

---

## Project Documentation

| Document | Contents |
| :--- | :--- |
| [`docs/PRD.md`](docs/PRD.md) | Problem statement, user roles, CRUD fields, 16-metric SQL mapping, polling budgets, failure modes |
| [`docs/Architecture.md`](docs/Architecture.md) | System topology, MySQL DDL, dynamic PDO lifecycle, queue & Reverb event contracts |
| [`docs/Design.md`](docs/Design.md) | Color tokens, typography (`tabular-nums`), table anatomy, anti-AI visual rules |
| [`docs/Phases.md`](docs/Phases.md) | 5-phase incremental build roadmap and exit criteria |
| [`docs/Rules.md`](docs/Rules.md) | PHP/Laravel, React 19/TypeScript, security, git, and testing standards |
| [`docs/Memory.md`](docs/Memory.md) | Living project state log, verified FieldMA clone schema quirks, and operational gotchas |
