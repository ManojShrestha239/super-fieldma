# System Architecture — FieldMA Central Monitor

## 1. High-Level System Topology

```text
                        +--------------------------------------------+
                        |         Browser (React 19 + Inertia v2)    |
                        |  - Single Point Dashboard (16-col table)   |
                        |  - Instance CRUD Drawer + Test Connection  |
                        |  - Laravel Echo (pusher-js -> Reverb WS)   |
                        +----------+----------------------+----------+
                                   | HTTPS (Inertia/XHR)  | WSS (Reverb)
                                   v                      v
                        +--------------------------------------------+
                        |             Nginx Reverse Proxy            |
                        |  /          -> PHP-FPM (Laravel 12+)       |
                        |  /app/*     -> Reverb WS (:8080)           |
                        +----------+----------------------+----------+
                                   |                      |
                  +----------------+                      +----------------+
                  v                                                        v
     +--------------------------+                             +-------------------------+
     |   Laravel App (PHP 8.2+) |                             |  Laravel Reverb Server  |
     |  - Controllers / Inertia |                             |  - private-fieldma.*    |
     |  - Form Requests / DTOs  |                             |  - Redis Pub/Sub scale  |
     +------------+-------------+                             +------------+------------+
                  |                                                        ^
                  | Eloquent / Cache / Queue                               | BroadcastNow
                  v                                                        |
     +--------------------------+       +----------------------------------+------------+
     |  Central MySQL 8         |       |  Redis (Queue + Schema Cache + Reverb PubSub) |
     |  - users                 |       +--------------------------+--------------------+
     |  - fieldma_instances     |                                  |
     |  - fieldma_daily_        |                                  v
     |    snapshots             |       +-----------------------------------------------+
     +--------------------------+       |  Supervisor Pool: 8-10 Polling Queue Workers  |
                  ^                     |  - Scheduler: DispatchFieldmaPolls (every 1m) |
                  | Upsert snapshot     |  - Job: PollFieldmaInstanceJob (timeout 15s)  |
                  +---------------------+-----------------------------------------------+
                                                                   |
                                            Ephemeral Read-Only PDO Connections
                                            (PDO::ATTR_TIMEOUT=3, DB::purge() in finally)
                                         +-------------+-----------+-------------+
                                         v             v                         v
                                  [FieldMA DB #1] [FieldMA DB #2]  ...    [FieldMA DB #40+]
```

---

## 2. Central MySQL 8 Schema

### 2.1 `users`
Standard Laravel authentication table extended with:
- `role`: `ENUM('admin', 'viewer') NOT NULL DEFAULT 'viewer'`

### 2.2 `fieldma_instances`
Stores registry metadata and encrypted connection credentials for each deployment.

```sql
CREATE TABLE fieldma_instances (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    slug            VARCHAR(120) NOT NULL UNIQUE,
    app_url         VARCHAR(255) NOT NULL,
    db_ip           VARCHAR(255) NOT NULL,
    db_port         SMALLINT UNSIGNED NOT NULL DEFAULT 3306,
    db_database     VARCHAR(128) NOT NULL,
    db_user         VARCHAR(128) NOT NULL,
    db_password     TEXT NOT NULL,                 -- Laravel encrypted cast
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    notes           TEXT NULL,
    last_tested_at  TIMESTAMP NULL,
    last_test_ok    TINYINT(1) NULL,
    last_latency_ms INT UNSIGNED NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,

    INDEX idx_instances_active_name (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.3 `fieldma_daily_snapshots`
Stores one upserted row per `(fieldma_instance_id, snapshot_date)`. All 16 metric columns are `INT UNSIGNED NULL` so `NULL` unambiguously represents **missing table / N/A** while `0` represents a verified zero count.

```sql
CREATE TABLE fieldma_daily_snapshots (
    id                            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fieldma_instance_id           BIGINT UNSIGNED NOT NULL,
    snapshot_date                 DATE NOT NULL,
    status                        ENUM('online', 'degraded', 'offline') NOT NULL,
    latency_ms                    INT UNSIGNED NULL,
    error_code                    VARCHAR(64) NULL,
    error_message                 VARCHAR(255) NULL,

    -- 16 Live Metrics (NULL = table missing / N/A)
    users_count                   INT UNSIGNED NULL,
    login_users_count             INT UNSIGNED NULL,
    checked_in_users_count        INT UNSIGNED NULL,
    checked_out_users_count       INT UNSIGNED NULL,
    orders_count                  INT UNSIGNED NULL,
    online_visits_count           INT UNSIGNED NULL,
    offline_visits_count          INT UNSIGNED NULL,
    unlisted_visits_count         INT UNSIGNED NULL,
    collections_count             INT UNSIGNED NULL,
    daily_reports_count           INT UNSIGNED NULL,
    expense_entries_count         INT UNSIGNED NULL,
    gps_tracked_users_count       INT UNSIGNED NULL,
    messages_users_count          INT UNSIGNED NULL,
    scheduled_visits_users_count  INT UNSIGNED NULL,
    site_registrations_count      INT UNSIGNED NULL,
    notices_count                 INT UNSIGNED NULL,

    missing_tables                JSON NULL,
    polled_at                     TIMESTAMP NOT NULL,
    created_at                    TIMESTAMP NULL,
    updated_at                    TIMESTAMP NULL,

    CONSTRAINT fk_snapshots_instance
        FOREIGN KEY (fieldma_instance_id) REFERENCES fieldma_instances(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_instance_snapshot_date (fieldma_instance_id, snapshot_date),
    INDEX idx_snapshot_date_status (snapshot_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. Dynamic Remote MySQL Connection Lifecycle

Every remote probe (both `TestConnection` and `PollFieldmaInstanceJob`) goes through a single dedicated service: `App\Services\RemoteDatabaseConnector`.

### 3.1 Connection Construction & Teardown
1. Generate a collision-free ephemeral connection name:
   `fieldma_probe_{instance_id|draft}_{uniqid}`
2. Register temporary runtime config:
   ```php
   config(["database.connections.{$connName}" => [
       'driver' => 'mysql',
       'host' => $credentials->dbIp,
       'port' => $credentials->dbPort,
       'database' => $credentials->dbDatabase,
       'username' => $credentials->dbUser,
       'password' => $credentials->dbPassword, // decrypted in memory only
       'charset' => 'utf8mb4',
       'collation' => 'utf8mb4_unicode_ci',
       'prefix' => '',
       'strict' => false, // tolerant of older MySQL 5.7 / MariaDB clones
       'engine' => null,
       'options' => [
           PDO::ATTR_TIMEOUT => 3,
           PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
           PDO::ATTR_EMULATE_PREPARES => false,
           PDO::MYSQL_ATTR_INIT_COMMAND => 'SET SESSION TRANSACTION READ ONLY',
       ],
   ]]);
   ```
3. Execute the read-only callback inside `try { ... } finally { ... }`:
   ```php
   finally {
       DB::purge($connName);
       config()->offsetUnset("database.connections.{$connName}");
   }
   ```
   - `DB::purge()` closes the underlying PDO handle and removes the connection from Laravel's `DatabaseManager` pool, preventing connection leaks across long-running queue workers.

### 3.2 Schema-Drift Table Cache (`SHOW TABLES`)
- **Cache Key:** `fieldma:tables:{instance_id}` in Redis (TTL: **6 hours**).
- **Invalidation:** Automatically invalidated when an instance is updated or when `Test Connection` runs. Also auto-refreshed once if a remote query throws SQLSTATE `42S02` (Base table or view not found).
- **Single-Query Compilation (`MetricsCollector`):**
  1. Loads the cached `array<string, true>` lookup map of existing lowercase table names.
  2. For each of the 16 metrics, checks if its required table(s) exist in the map.
     - If present: emits the parameterized scalar subquery.
     - If absent: emits `NULL AS <metric_column>` and records the missing table name in `$missingTables`.
  3. Executes **one single `SELECT`** statement with bound `:day_start` and `:day_end` parameters:
     ```sql
     SELECT /*+ MAX_EXECUTION_TIME(5000) */
       (SELECT COUNT(*) FROM mobileusers) AS users_count,
       ...
     ```
     *(If a legacy MySQL 5.6/MariaDB server rejects the optimizer hint, the hint is ignored as a standard SQL comment.)*
  4. Computes status:
     - `offline` on connection/query exception.
     - `degraded` if `latency_ms >= 1500` OR `count($missingTables) > 0`.
     - `online` otherwise.

---

## 4. Queue Topology & Scheduler

| Component | Configuration | Purpose |
| :--- | :--- | :--- |
| **Scheduler** | `DispatchFieldmaPolls` every minute (`->everyMinute()->withoutOverlapping(55)`) | Queries `FieldmaInstance::where('is_active', true)->pluck('id')` and dispatches one `PollFieldmaInstanceJob` per ID onto the `polling` queue. |
| **Polling Queue** | Queue name: `polling`; `tries = 1`; `timeout = 15`; `backoff = 0` | Isolates remote I/O from default app jobs. Zero retries because the next 60s tick naturally retries without piling up stale jobs. |
| **Worker Pool** | 8–10 processes (`php artisan queue:work redis --queue=polling,default --sleep=1 --tries=1 --max-time=3600`) | Handles 40–60+ instances in parallel with bounded memory. |
| **Cache & Queue Driver** | Redis in Docker & production (database queue fallback supported via `.env` for minimal setups) | Sub-millisecond job dispatch, atomic `withoutOverlapping` locks, and Reverb pub/sub. |

---

## 5. Laravel Reverb Channel & Event Contracts

### 5.1 Channel Authorization (`routes/channels.php`)
```php
Broadcast::channel('fieldma.dashboard', fn (User $user): bool => $user !== null);
```
- **Channel Name:** `private-fieldma.dashboard` (subscribed via `Echo.private('fieldma.dashboard')`).

### 5.2 Broadcast Event (`App\Events\FieldmaMetricsUpdated`)
- Implements `ShouldBroadcastNow` (dispatches directly from the polling worker to Reverb without a second queue hop).
- Broadcast alias: `broadcastAs(): string => 'metrics.updated'`.
- **Exact Payload Contract** (mirrors TypeScript `FieldmaMetricsUpdatedPayload` strictly):

```json
{
  "instance_id": 14,
  "snapshot_date": "2026-11-23",
  "status": "online",
  "latency_ms": 142,
  "polled_at": "2026-11-23T07:05:12Z",
  "error_code": null,
  "error_message": null,
  "missing_tables": [],
  "metrics": {
    "users_count": 312,
    "login_users_count": 248,
    "checked_in_users_count": 219,
    "checked_out_users_count": 14,
    "orders_count": 87,
    "online_visits_count": 405,
    "offline_visits_count": 32,
    "unlisted_visits_count": 9,
    "collections_count": 41,
    "daily_reports_count": 18,
    "expense_entries_count": 29,
    "gps_tracked_users_count": 215,
    "messages_users_count": 64,
    "scheduled_visits_users_count": 190,
    "site_registrations_count": 5,
    "notices_count": 3
  }
}
```
- **Strict Guarantee:** Zero database credentials (`db_ip`, `db_user`, `db_password`) are ever included in the broadcast payload.

### 5.3 Frontend State Patching
1. Dashboard holds `rows: DashboardRow[]` in React state, initialized from Inertia props (`initialRows`).
2. `useEffect` subscribes to `Echo.private('fieldma.dashboard').listen('.metrics.updated', handler)`.
3. Inside `handler(payload)`:
   - If `payload.snapshot_date !== selectedDateRef.current`, return immediately (ignore live pushes on historical dates).
   - Compare each metric key against the existing row; collect changed metric keys into a `flashingCells` map (`"${instance_id}:${metricKey}"`) with a 600ms cleanup timer.
   - Immutably replace only the matching row in `rows`.
   - `filteredAndSortedRows` and `totalsRow` are derived via `useMemo`, so search text, sort state, scroll position, and open dialogs are never disturbed.

---

## 6. Local Docker Dev vs. Production Native Topology

### 6.1 Local Development (`docker-compose.yml` only)
| Service | Image / Build | Port(s) | Responsibility |
| :--- | :--- | :--- | :--- |
| `app` | Custom PHP 8.3-FPM + Composer + PDO MySQL + Redis ext | internal `9000` | Laravel application runtime |
| `nginx` | `nginx:1.27-alpine` | `8080:80` | HTTP + WebSocket reverse proxy (`/app` -> `reverb:8080`) |
| `vite` | `node:22-alpine` | `5173:5173` | Vite HMR for React 19 + TypeScript + Tailwind |
| `mysql` | `mysql:8.4` | `33061:3306` | Central registry & snapshots database |
| `redis` | `redis:7-alpine` | `63791:6379` | Queues, schema cache, Reverb pub/sub |
| `worker` | Same image as `app` | — | `php artisan queue:work redis --queue=polling,default` (scaleable via `--scale worker=4`) |
| `scheduler` | Same image as `app` | — | `php artisan schedule:work` |
| `reverb` | Same image as `app` | `8081:8080` | `php artisan reverb:start --host=0.0.0.0 --port=8080` |
| `mock-remote-db` | `mysql:8.4` | `33062:3306` | Local test MySQL hosting 2–3 mock FieldMA databases (full schema + legacy schema with missing tables) |

### 6.2 Production Native Deployment (Linux / Nginx / Supervisor)
- **Web:** Nginx + PHP 8.3-FPM with Unix socket; Nginx proxies `/app` and `/apps` to `127.0.0.1:8080` (Reverb) with `Upgrade`/`Connection` headers and `proxy_read_timeout 60s`.
- **Supervisor Programs:**
  - `fieldma-polling-worker` (`numprocs=10`, `command=php artisan queue:work redis --queue=polling,default --sleep=1 --tries=1 --max-time=3600`)
  - `fieldma-reverb` (`numprocs=1`, `command=php artisan reverb:start --host=127.0.0.1 --port=8080`)
- **Cron:** Single system cron entry `* * * * * cd /var/www/fieldma-monitor && php artisan schedule:run >> /dev/null 2>&1`.
- **Network Security:** Production server egress to remote FieldMA MySQL ports (`3306`) is restricted via WireGuard/VPN or IP allowlists.
