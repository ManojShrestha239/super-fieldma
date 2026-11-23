# Product Requirements Document — FieldMA Central Monitor

## 1. Problem Statement
Operations engineers currently manage **40+ independent FieldMA deployments** (each running its own Laravel application and isolated MySQL database). Monitoring daily field-force adoption, sync health, and database reachability requires manually logging into individual admin panels or querying remote databases one by one. Silent failures—such as broken attendance check-ins, stalled GPS pings, or unreachable database hosts—go unnoticed until clients report them.

**FieldMA Central Monitor** provides a single-point internal operations console that registers all FieldMA instances, polls their remote MySQL databases in parallel on a fixed cadence, persists daily snapshots, and streams live row-level updates over WebSockets to a high-density operational table.

---

## 2. User Roles & Permissions

| Role | Access Scope | Capabilities |
| :--- | :--- | :--- |
| **Ops Admin (`admin`)** | Full internal console | View live & historical dashboard; create, edit, deactivate, and delete FieldMA instances; run ad-hoc Test Connection; trigger manual single-instance or fleet-wide poll; invalidate cached table schemas. |
| **Ops Viewer (`viewer`)** | Read-only monitoring | View live & historical dashboard, filter/search/sort rows, inspect error states and missing-table tooltips, export current table view (CSV). Cannot view/modify instance connection details or trigger mutations. |

*v1 Scope Note:* Authentication uses standard Laravel session auth (no public self-registration; users are provisioned via artisan seeder/CLI). Every route and private Reverb channel requires authentication.

---

## 3. Core Functional Requirements

### 3.1 FieldMA Instance CRUD Registry
Manage 40+ independent FieldMA deployments with the following exact fields:

| Field | Type | Validation Rules | Notes |
| :--- | :--- | :--- | :--- |
| `name` | `string(120)` | Required, string, max 120 | Human-readable deployment name (e.g., `Acme Pharma Nepal`). |
| `slug` | `string(120)` | Required, unique, `alpha_dash`, lowercase | Stable URL/identifier key (auto-suggested from `name`, editable). |
| `app_url` | `string(255)` | Required, valid `http`/`https` URL | Direct link to the FieldMA web deployment. |
| `db_ip` | `string(255)` | Required, valid IPv4/IPv6 or hostname | Remote MySQL host address. |
| `db_port` | `uint16` | Required, integer, `1..65535` | Defaults to `3306`. |
| `db_database` | `string(128)` | Required, regex `^[a-zA-Z0-9_$-]+$` | Remote MySQL schema/database name. |
| `db_user` | `string(128)` | Required, string, max 128 | Dedicated read-only MySQL username. |
| `db_password` | `text` (encrypted) | Required on create; nullable on update | Stored using Laravel's `encrypted` cast. **Never serialized** to Inertia props, JSON APIs, logs, exception traces, or Reverb broadcasts. Leaving blank on update preserves the stored secret. |
| `is_active` | `boolean` | Required, boolean (default `true`) | Inactive instances are excluded from scheduled polling but retained for historical snapshots. |
| `notes` | `text` | Nullable, max 2000 | Operational notes (e.g., VPN dependency, legacy clone version, client contact). |

#### Test Connection Endpoint
- **Endpoints:**
  - `POST /instances/test-connection` — validates unsaved form credentials inside the Create/Edit drawer before saving.
  - `POST /instances/{instance}/test-connection` — tests a persisted instance (optionally overriding unsaved fields; uses stored encrypted password if `db_password` is omitted).
- **Behavior:**
  1. Opens an ephemeral runtime MySQL connection with `PDO::ATTR_TIMEOUT => 3` and `SET SESSION TRANSACTION READ ONLY`.
  2. Executes `SELECT VERSION()` and `SHOW TABLES` while measuring round-trip latency in milliseconds.
  3. Compares discovered tables against the 16 required FieldMA tables and refreshes the per-instance schema cache.
  4. Always executes `DB::purge($connectionName)` and unsets runtime config in a `finally` block.
  5. Returns sanitized JSON: `{ ok, latency_ms, mysql_version, tables_found, missing_tables, error_code, error_message }`.

---

### 3.2 Single Point Dashboard (16 Live Metrics Table)
- **Layout:** One row per active FieldMA instance, filterable by `date` (defaults to today in `APP_TIMEZONE`, e.g., `Asia/Kathmandu`).
- **Navigation & Filtering:**
  - Date picker with quick `Today` reset and previous/next day steppers.
  - Instant client-side search (matches `name`, `slug`, `db_ip`, `notes`).
  - Status filter pills: `All`, `Online`, `Degraded`, `Offline`.
  - Column sorting (instance name, latency, or any of the 16 metrics) without resetting scroll position on WebSocket updates.
- **Sticky Ergonomics:** Sticky table header (with 2-tier column-group headers), sticky left column (Instance Name, Status indicator, Latency), and a dynamic **Totals Summary Row** that aggregates all currently visible rows (treating `null` / `N/A` cells as `0` in sums while displaying `—` in the individual cell).
- **Historical Mode:** When viewing any date prior to today, the table renders persisted `fieldma_daily_snapshots` for that date and **ignores live WebSocket pushes** targeting today.

#### The 16 Metrics & Exact SQL Mapping
All 16 metrics are fetched in **one single SQL round-trip** per remote database using scalar subqueries against half-open date bounds (`:day_start` = `YYYY-MM-DD 00:00:00`, `:day_end` = `(YYYY-MM-DD + 1 day) 00:00:00`) so remote `created_at` indexes remain sargable.

| # | Metric Label | Column Key | Source Table(s) | Exact SQL Subquery Expression | Schema-Drift Fallback |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | No. of Users | `users_count` | `mobileusers` | `(SELECT COUNT(*) FROM mobileusers)` | `NULL` if `mobileusers` missing |
| 2 | Login Users | `login_users_count` | `device_logs` / `mobileusers` | If `device_logs` exists: `(SELECT COUNT(DISTINCT user_id) FROM device_logs WHERE created_at >= :day_start AND created_at < :day_end)` else `(SELECT COUNT(*) FROM mobileusers WHERE fcm_id IS NOT NULL AND fcm_id <> '')` | `NULL` if both missing (or column check fails) |
| 3 | Checked-In Users | `checked_in_users_count` | `attendance_statuses` | `(SELECT COUNT(DISTINCT mobileuser_id) FROM attendance_statuses WHERE status = 'checkin' AND created_at >= :day_start AND created_at < :day_end)` | `NULL` if `attendance_statuses` missing |
| 4 | Checked-Out Users | `checked_out_users_count` | `attendance_statuses` | `(SELECT COUNT(DISTINCT mobileuser_id) FROM attendance_statuses WHERE status = 'checkout' AND created_at >= :day_start AND created_at < :day_end)` | `NULL` if `attendance_statuses` missing |
| 5 | Total Orders | `orders_count` | `orders` | `(SELECT COUNT(*) FROM orders WHERE created_at >= :day_start AND created_at < :day_end)` | `NULL` if `orders` missing |
| 6 | Online Visits | `online_visits_count` | `visits` | `(SELECT COUNT(*) FROM visits WHERE LOWER(status) = 'online' AND created_at >= :day_start AND created_at < :day_end)` | `NULL` if `visits` missing |
| 7 | Offline Visits | `offline_visits_count` | `visits` | `(SELECT COUNT(*) FROM visits WHERE LOWER(status) = 'offline' AND created_at >= :day_start AND created_at < :day_end)` | `NULL` if `visits` missing |
| 8 | Unlisted Visits | `unlisted_visits_count` | `visits` | `(SELECT COUNT(*) FROM visits WHERE LOWER(status) = 'unlisted' AND created_at >= :day_start AND created_at < :day_end)` | `NULL` if `visits` missing |
| 9 | Total Collections | `collections_count` | `payments` | `(SELECT COUNT(*) FROM payments WHERE created_at >= :day_start AND created_at < :day_end)` | `NULL` if `payments` missing |
| 10 | Daily Reports | `daily_reports_count` | `tada_entries` | `(SELECT COUNT(*) FROM tada_entries WHERE deleted_at IS NULL AND created_at >= :day_start AND created_at < :day_end)` | `NULL` if `tada_entries` missing |
| 11 | Expense Entries | `expense_entries_count` | `tada_dealer_expenses`, `tada_other_expenses` | `(COALESCE((SELECT COUNT(*) FROM tada_dealer_expenses WHERE created_at >= :day_start AND created_at < :day_end), 0) + COALESCE((SELECT COUNT(*) FROM tada_other_expenses WHERE created_at >= :day_start AND created_at < :day_end), 0))` | Sum available table(s); `NULL` only if **both** are missing |
| 12 | GPS Tracked (1/user) | `gps_tracked_users_count` | `locations` | `(SELECT COUNT(DISTINCT user_id) FROM locations WHERE created_at >= :day_start AND created_at < :day_end)` | `NULL` if `locations` missing |
| 13 | Messages (1/user) | `messages_users_count` | `messages` | ``(SELECT COUNT(DISTINCT `from`) FROM messages WHERE created_at >= :day_start AND created_at < :day_end)`` | `NULL` if `messages` missing |
| 14 | Scheduled Visits (1/user) | `scheduled_visits_users_count` | `schedulevisits` | `(SELECT COUNT(DISTINCT user_id) FROM schedulevisits WHERE created_at >= :day_start AND created_at < :day_end)` | `NULL` if `schedulevisits` missing |
| 15 | Site Registrations | `site_registrations_count` | `site_registration_v2_s` | `(SELECT COUNT(*) FROM site_registration_v2_s WHERE created_at >= :day_start AND created_at < :day_end)` | `NULL` if `site_registration_v2_s` missing |
| 16 | Total Notices | `notices_count` | `notices` | `(SELECT COUNT(*) FROM notices WHERE created_at >= :day_start AND created_at < :day_end)` | `NULL` if `notices` missing |

*Note on Metric #2 (`login_users_count`):* Older FieldMA clones do not have `device_logs` (or track active sessions solely via `mobileusers.fcm_id`). The collector inspects the cached table list and selects the `device_logs` subquery when available (with fallback to `mobileusers.fcm_id IS NOT NULL`), ensuring consistent behavior across generations.

---

### 3.3 Real-Time WebSocket Updates
- Every 60 seconds, the scheduler dispatches one `PollFieldmaInstanceJob` per active instance onto the `polling` queue.
- Each job polls its assigned remote DB, upserts `fieldma_daily_snapshots` for `(fieldma_instance_id, snapshot_date)`, and broadcasts `FieldmaMetricsUpdated` on `private-fieldma.dashboard` via Laravel Reverb.
- The React dashboard listens via Laravel Echo and patches **only the matching row** in local state by `instance_id`—preserving active search text, sort column/direction, scroll offsets, and any open CRUD drawer or dialog.
- If the Reverb WebSocket disconnects, the UI displays a subtle `Reconnecting` status indicator in the top bar and triggers an Inertia partial reload (`only: ['rows']`) upon reconnection to close any missed-event gap.

---

## 4. Non-Functional Requirements

### 4.1 Polling Budget & Performance (40–60+ Instances)
- **Cadence:** 60 seconds per full fleet cycle.
- **Parallelism:** 8–10 concurrent Supervisor queue workers dedicated to the `polling` queue.
- **Per-Instance Budgets:**
  - TCP/PDO connect timeout: **3 seconds** (`PDO::ATTR_TIMEOUT => 3`).
  - Query execution timeout: **5 seconds** (`/*+ MAX_EXECUTION_TIME(5000) */` on MySQL 8, plus PHP job timeout of `15s`).
  - Degraded latency threshold: **`>= 1500ms`** (marks snapshot `status = 'degraded'` while still displaying metrics).
- **Fleet Math:** At 50 instances with 10 workers and ~200ms average query latency, a healthy cycle completes in **~1.5 seconds**. Even with 10 completely unreachable hosts timing out at 3s each, the cycle completes in **< 6 seconds**—well inside the 60s window with zero queue backlog.

### 4.2 Security & Credential Hygiene
- `db_password` is encrypted at rest with Laravel's `APP_KEY` (`encrypted` Eloquent cast) and marked `$hidden` on the model.
- Remote database accounts provisioned for FieldMA Central Monitor must hold `SELECT` privilege only. As defense-in-depth, every runtime connection initializes with `SET SESSION TRANSACTION READ ONLY`.
- SQL exception messages are sanitized before persisting to `error_message` or broadcasting over Reverb (strip host credentials, SQL query dumps, and stack traces; map PDO error codes to concise ops codes like `CONN_TIMEOUT`, `AUTH_FAILED`, `UNKNOWN_DB`, `QUERY_ERROR`).
- Input validation rejects control characters and invalid database identifiers before building dynamic connection configs.

### 4.3 Failure Modes & Resilience
| Failure Scenario | System Behavior | Dashboard UX |
| :--- | :--- | :--- |
| Remote host unreachable / firewall drop | PDO times out at 3s; `DB::purge()` runs in `finally`; snapshot upserted as `offline` with `CONN_TIMEOUT`. | Row shows rose `Offline` dot; previous/null values dimmed; hover tooltip displays error code + timestamp. |
| Invalid DB credentials | Immediate MySQL error 1045; marked `offline` with `AUTH_FAILED`. | Rose `Offline` dot + `Auth failed` tooltip; quick link to edit instance credentials. |
| Missing table on older clone | Cached `SHOW TABLES` omits missing table; collector emits `NULL` for affected metric(s); status becomes `degraded` if any required table is missing. | Affected cells render `—` (`N/A`) with tooltip naming the missing table; other metrics render normally. |
| Slow remote DB (`>= 1500ms`) | Query succeeds; snapshot marked `degraded`. | Amber `Degraded` dot + amber latency badge (e.g., `2,140 ms`). |
| Reverb server restart | Echo auto-reconnects with exponential backoff; triggers Inertia partial reload on reconnect. | Header status dot shifts emerald → amber (`Reconnecting`) → emerald. |

---

## 5. Out-of-Scope Boundaries (v1)
- **No remote writes or DDL:** Central Monitor never mutates remote FieldMA data, runs migrations, or clears remote caches.
- **No SSH / server-level telemetry:** CPU, RAM, disk, and Nginx log scraping are out of scope for v1.
- **No multi-tenant customer portal:** Strictly an internal operations tool.
- **No row-level PII ingestion:** Central Monitor stores only aggregated integer counts per instance per day—never user names, phone numbers, order items, or GPS coordinates.
- **No alerting integrations (Slack/Email/PagerDuty) in v1:** Snapshot history and status transitions are structured cleanly so alert hooks can be added in a later phase without schema changes.
