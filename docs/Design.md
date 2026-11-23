# Design System & UI Specification — FieldMA Central Monitor

## 1. Visual Philosophy & Mandatory Anti-AI Rules
FieldMA Central Monitor is a **high-density internal engineering console** modeled after Linear, Datadog, and Grafana operational tables. Every pixel must prioritize scan speed, numeric alignment, and zero visual noise.

### Strictly Banned Patterns
- **No purple/indigo gradients** or decorative accent gradients anywhere.
- **No glassmorphism** (`backdrop-blur`), neon glow shadows, or floating soft-shadow cards.
- **No decorative hero banners** or marketing-style headers.
- **No redundant KPI summary cards** above the table—the **Totals Summary Row** inside the table is the single source of aggregate truth.
- **No emojis** anywhere in the UI, empty states, tooltips, or toast notifications.
- **No stock uncustomized shadcn/ui look**—override radii to crisp `rounded-md` / `rounded-sm` (`4px–6px`), tighten paddings, and replace soft shadows with crisp `1px` structural borders.

---

## 2. Color Tokens (Neutral Slate/ZincOps Palette)

Primary theme is a crisp, high-contrast **Light Ops Console** (with optional dark mode token parity using Zinc-950/900). Semantic colors are strictly reserved for operational status indicators, latency warnings, and subtle live-update cell flashes.

| Token Role | Light Mode (Default) | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas / Page Bg** | `bg-zinc-50` (`#fafafa`) | `bg-zinc-950` (`#09090b`) | Outer viewport background |
| **Surface / Table Bg** | `bg-white` (`#ffffff`) | `bg-zinc-900` (`#18181b`) | Table body, top bar, slide-over drawer |
| **Subtle Surface** | `bg-zinc-100/70` (`#f4f4f5`) | `bg-zinc-800/60` (`#27272a`) | Column-group header row, Totals row, hover states |
| **Primary Border** | `border-zinc-200` (`#e4e4e7`) | `border-zinc-800` (`#27272a`) | `1px` grid lines, sticky column divider, inputs |
| **Strong Border** | `border-zinc-300` (`#d4d4d8`) | `border-zinc-700` (`#3f3f46`) | Header bottom divider, Totals row top border |
| **Primary Text** | `text-zinc-900` (`#18181b`) | `text-zinc-100` (`#f4f4f5`) | Instance names, non-zero metric figures |
| **Secondary Text** | `text-zinc-600` (`#52525b`) | `text-zinc-400` (`#a1a1aa`) | Column headers, metadata, timestamps |
| **Muted / Zero Text** | `text-zinc-400` (`#a1a1aa`) | `text-zinc-600` (`#52525b`) | `0` values (reduces visual noise), `—` (`N/A`) missing-table cells |
| **Status: Online** | `emerald-600` / dot `bg-emerald-500` | `emerald-400` / dot `bg-emerald-500` | Healthy connection (< 1500ms, no missing tables) |
| **Status: Degraded** | `amber-600` / dot `bg-amber-500` | `amber-400` / dot `bg-amber-500` | Slow query (>= 1500ms) or missing remote tables |
| **Status: Offline** | `rose-600` / dot `bg-rose-500` | `rose-400` / dot `bg-rose-500` | Timeout, auth error, or query failure |
| **Interactive Primary** | `bg-zinc-900 text-white hover:bg-zinc-800` | `bg-zinc-100 text-zinc-950 hover:bg-zinc-200` | Primary buttons (`+ Add Instance`, `Save`) |

---

## 3. Typography & Numeric Alignment
- **UI Font:** `Inter`, system-ui, sans-serif.
- **Monospace Font:** `JetBrains Mono`, `ui-monospace`, monospace — used for DB IPs, latency (`142 ms`), error codes (`CONN_TIMEOUT`), timestamps (`12:44:05`), and numeric table cells.
- **Mandatory `tabular-nums`:** Every numeric cell, latency readout, timestamp, and Totals Row cell MUST include `tabular-nums` (`font-variant-numeric: tabular-nums`) so WebSocket updates never cause horizontal jitter or column reflow.
- **Scale (High Density):**
  - Top bar title: `text-sm font-semibold tracking-tight` (`14px`)
  - Column-group headers: `text-[11px] font-semibold uppercase tracking-wider text-zinc-500`
  - Column sub-headers: `text-xs font-medium text-zinc-600` (`12px`)
  - Table body cells: `text-[13px] leading-5` (`13px`)
  - Secondary metadata (latency / IP): `text-[11px] font-mono text-zinc-500`

---

## 4. Single Point Dashboard Layout & Table Anatomy

### 4.1 Top Utility Bar (Single `48px` Row, `border-b border-zinc-200`)
Left to right:
1. **Brand / Console Title:** `FieldMA Central Monitor` + compact live WebSocket indicator (`Live` with 6px emerald dot, or `Reconnecting` with amber dot).
2. **Date Control:** Compact `<` `[YYYY-MM-DD]` `>` date selector + `Today` pill button (hidden when already on today; shows `Historical Snapshot (Live Paused)` badge in muted zinc when viewing past dates).
3. **Search Input:** Compact `w-60 h-8` input (`Filter instances by name, slug, IP...`) with `/` keyboard shortcut hint.
4. **Status Filter Segmented Control:** `All (44)` | `Online (41)` | `Degraded (2)` | `Offline (1)` with `tabular-nums` counts.
5. **Right Actions:** `Poll All` button (admin only, rate-limited with spinner), `+ Add Instance` primary button (admin only), and user menu (sign out).

### 4.2 Two-Tier Sticky Table Structure
- **Viewport Fit:** Table container occupies `calc(100vh - 48px)` with `overflow-auto`, keeping both header and Totals row visible without page-level double scrollbars.
- **Row Height:** Compact `36px` (`py-1.5 px-2.5`) so 20+ instances fit cleanly on a 1080p screen without scrolling.
- **Sticky Left Column (`min-w-[240px] max-w-[260px] sticky left-0 z-20`):**
  - Displays: 6px status dot + **Instance Name** (clickable external link icon to `app_url` on hover) + right-aligned monospace latency (`142ms`).
  - Hovering the sticky cell reveals compact icon actions: `Edit`, `Test`, `Poll Now` (admin only).
  - Crisp `1px` right border (`border-r border-zinc-200`) separating pinned identity from scrollable metrics.

#### Column Groups & Exact Column Order
| Group Header | Columns (all right-aligned, `tabular-nums`, `min-w-[84px]`) |
| :--- | :--- |
| **Instance** *(Sticky Left)* | Instance Name · Status · Latency |
| **Users & Attendance** | Users · Logins · Check-In · Check-Out |
| **Visits** | Online · Offline · Unlisted · Scheduled |
| **Orders & Finance** | Orders · Collections · Daily Reports · Expenses |
| **Field Activity** | GPS (1/u) · Messages (1/u) · Site Regs · Notices |

*(Each group boundary carries a stronger `border-l border-zinc-200` vertical separator for fast horizontal scanning.)*

### 4.3 Dynamic Totals Summary Row
- Pinned at the bottom of the scroll viewport (`sticky bottom-0 z-20 bg-zinc-100 border-t-2 border-zinc-300 font-semibold`).
- Sticky left cell reads: `Total (42 instances)` (reflecting active search/status filters).
- Each of the 16 metric cells displays the formatted integer sum (`Intl.NumberFormat('en-US')`) in bold `tabular-nums`.
- Non-numeric `null` (`N/A`) cells are excluded from sums without turning the total into `NaN`.

### 4.4 Row & Cell States
- **Online Row:** Emerald 6px dot, crisp zinc-900 numbers, zinc-400 for `0` values so active non-zero figures pop naturally.
- **Degraded Row:** Amber 6px dot; latency text in `text-amber-600` if `>= 1500ms`; subtle `Schema` badge with tooltip listing missing tables if `missing_tables.length > 0`.
- **Offline Row:** Rose 6px dot, subtle `bg-rose-50/40` row tint, concise monospace error code (`CONN_TIMEOUT`, `AUTH_FAILED`) inline in the sticky column subtitle, and `—` across metric cells (with tooltip showing `error_message` and `polled_at`).
- **Missing Table Cell (`null`):** Renders `—` in `text-zinc-400 font-mono` with a Radix Tooltip stating e.g. `Table 'site_registration_v2_s' not found on this instance`.
- **Live Update Flash:** When Reverb patches a row and a specific metric value changes, **only the changed cell(s)** run a subtle `600ms` CSS keyframe (`animate-cell-flash`: `bg-emerald-500/15` → `transparent`). Unchanged cells remain completely static.

---

## 5. Instance CRUD Drawer & Test Connection UX
- **Container:** Right-side slide-over Radix Sheet (`w-[480px]`, `border-l border-zinc-200`, `bg-white`) so operators never lose context of the monitoring table.
- **Form Sections (Tight Vertical Rhythm, `gap-3`):**
  1. **Identity:** `Name`, `Slug` (auto-derived until manually edited), `App URL`, `Active` toggle.
  2. **Remote MySQL Connection:** `DB Host / IP` + `Port` (side-by-side `3:1` grid), `Database Name`, `Username`, `Password` (`type="password"` with reveal toggle; on edit shows placeholder `Leave blank to keep existing password`).
  3. **Notes:** Compact 3-row textarea.
- **Inline Test Connection Panel:**
  - Dedicated `Test Connection` secondary button inside the drawer footer (next to `Cancel` and `Save Instance`).
  - Clicking runs `POST /instances/test-connection` (or `/{id}/test-connection`) and renders an inline 1px-bordered result strip directly above the footer:
    - **Success:** Emerald dot · `Connected in 84 ms · MySQL 8.0.36 · 48 tables` (plus amber note if any of the 16 expected tables are missing).
    - **Failure:** Rose dot · `CONN_TIMEOUT: Connection timed out after 3s` (sanitized, zero secrets).
- **Delete Confirmation:** Secondary Radix AlertDialog requiring the user to confirm deletion with an explicit warning that historical `fieldma_daily_snapshots` for that instance will be cascade-deleted.
