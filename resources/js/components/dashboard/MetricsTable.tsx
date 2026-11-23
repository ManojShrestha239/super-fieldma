import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    Loader2,
    Pencil,
    RefreshCw,
    Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DashboardRow, FieldmaMetrics } from "@/types/fieldma";

export type MetricKey = keyof FieldmaMetrics;
export type SortKey = "name" | "latency_ms" | MetricKey;
export type SortDirection = "asc" | "desc";

interface MetricColumnDef {
    key: MetricKey;
    label: string;
    group: "users" | "visits" | "finance" | "activity";
    requiredTables: readonly string[];
    isGroupStart?: boolean;
}

export const METRIC_COLUMNS: readonly MetricColumnDef[] = [
    // Group 1: Users & Attendance
    {
        key: "users_count",
        label: "Users",
        group: "users",
        requiredTables: ["mobileusers"],
        isGroupStart: true,
    },
    {
        key: "login_users_count",
        label: "Logins",
        group: "users",
        requiredTables: ["device_logs", "mobileusers"],
    },
    {
        key: "checked_in_users_count",
        label: "Check-In",
        group: "users",
        requiredTables: ["attendance_statuses"],
    },
    {
        key: "checked_out_users_count",
        label: "Check-Out",
        group: "users",
        requiredTables: ["attendance_statuses"],
    },

    // Group 2: Visits
    {
        key: "online_visits_count",
        label: "Online",
        group: "visits",
        requiredTables: ["visits"],
        isGroupStart: true,
    },
    {
        key: "offline_visits_count",
        label: "Offline",
        group: "visits",
        requiredTables: ["visits"],
    },
    {
        key: "unlisted_visits_count",
        label: "Unlisted",
        group: "visits",
        requiredTables: ["visits"],
    },
    {
        key: "scheduled_visits_users_count",
        label: "Scheduled",
        group: "visits",
        requiredTables: ["schedulevisits"],
    },

    // Group 3: Orders & Finance
    {
        key: "orders_count",
        label: "Orders",
        group: "finance",
        requiredTables: ["orders"],
        isGroupStart: true,
    },
    {
        key: "collections_count",
        label: "Collections",
        group: "finance",
        requiredTables: ["payments"],
    },
    {
        key: "daily_reports_count",
        label: "Reports",
        group: "finance",
        requiredTables: ["tada_entries"],
    },
    {
        key: "expense_entries_count",
        label: "Expenses",
        group: "finance",
        requiredTables: ["tada_dealer_expenses", "tada_other_expenses"],
    },

    // Group 4: Field Activity
    {
        key: "gps_tracked_users_count",
        label: "GPS (1/u)",
        group: "activity",
        requiredTables: ["locations"],
        isGroupStart: true,
    },
    {
        key: "messages_users_count",
        label: "Msgs (1/u)",
        group: "activity",
        requiredTables: ["messages"],
    },
    {
        key: "site_registrations_count",
        label: "Site Regs",
        group: "activity",
        requiredTables: ["v2_site_registrations", "site_registration_v2_s"],
    },
    {
        key: "notices_count",
        label: "Notices",
        group: "activity",
        requiredTables: ["notices"],
    },
];

const numberFormatter = new Intl.NumberFormat("en-US");

interface MetricsTableProps {
    rows: DashboardRow[];
    totalRegisteredCount: number;
    canManage: boolean;
    sortKey: SortKey;
    sortDirection: SortDirection;
    onSort: (key: SortKey) => void;
    flashingCells: ReadonlySet<string>;
    pollingInstanceIds: ReadonlySet<number>;
    onPollInstance: (row: DashboardRow) => void;
    onEditInstance: (row: DashboardRow) => void;
    onDeleteInstance: (row: DashboardRow) => void;
}

function formatTime(iso: string | null): string {
    if (!iso) {
        return "Not polled";
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return date.toLocaleTimeString("en-GB", { hour12: false });
}

export function MetricsTable({
    rows,
    totalRegisteredCount,
    canManage,
    sortKey,
    sortDirection,
    onSort,
    flashingCells,
    pollingInstanceIds,
    onPollInstance,
    onEditInstance,
    onDeleteInstance,
}: MetricsTableProps) {
    const totals = useMemo(() => {
        const sums: Record<MetricKey, number> = {
            users_count: 0,
            login_users_count: 0,
            checked_in_users_count: 0,
            checked_out_users_count: 0,
            orders_count: 0,
            online_visits_count: 0,
            offline_visits_count: 0,
            unlisted_visits_count: 0,
            collections_count: 0,
            daily_reports_count: 0,
            expense_entries_count: 0,
            gps_tracked_users_count: 0,
            messages_users_count: 0,
            scheduled_visits_users_count: 0,
            site_registrations_count: 0,
            notices_count: 0,
        };

        for (const row of rows) {
            for (const col of METRIC_COLUMNS) {
                const value = row.metrics[col.key];
                if (typeof value === "number") {
                    sums[col.key] += value;
                }
            }
        }

        return sums;
    }, [rows]);

    function renderSortIndicator(key: SortKey) {
        if (sortKey !== key) {
            return null;
        }
        return sortDirection === "asc" ? (
            <ArrowUp className="inline h-3 w-3 text-zinc-800" />
        ) : (
            <ArrowDown className="inline h-3 w-3 text-zinc-800" />
        );
    }

    return (
        <table className="w-max min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-zinc-100 text-zinc-600">
                {/* Tier 1: Column Group Headers */}
                <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th
                        rowSpan={2}
                        className="sticky left-0 z-30 min-w-[260px] max-w-[280px] border-b border-r border-zinc-300 bg-zinc-100 px-3 py-1.5 align-bottom"
                    >
                        <div className="flex items-center justify-between gap-2 text-xs font-medium normal-case tracking-normal text-zinc-700">
                            <button
                                type="button"
                                onClick={() => onSort("name")}
                                className="inline-flex items-center gap-1 hover:text-zinc-950 cursor-pointer"
                            >
                                Instance {renderSortIndicator("name")}
                            </button>
                            <button
                                type="button"
                                onClick={() => onSort("latency_ms")}
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 hover:text-zinc-950 cursor-pointer"
                            >
                                Latency {renderSortIndicator("latency_ms")}
                            </button>
                        </div>
                    </th>
                    <th
                        colSpan={4}
                        className="border-l border-zinc-200 px-2.5 py-1 text-center"
                    >
                        Users &amp; Attendance
                    </th>
                    <th
                        colSpan={4}
                        className="border-l border-zinc-200 px-2.5 py-1 text-center"
                    >
                        Visits
                    </th>
                    <th
                        colSpan={4}
                        className="border-l border-zinc-200 px-2.5 py-1 text-center"
                    >
                        Orders &amp; Finance
                    </th>
                    <th
                        colSpan={4}
                        className="border-l border-zinc-200 px-2.5 py-1 text-center"
                    >
                        Field Activity
                    </th>
                </tr>

                {/* Tier 2: Individual Metric Headers */}
                <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-medium text-zinc-600">
                    {METRIC_COLUMNS.map((col) => (
                        <th
                            key={col.key}
                            className={cn(
                                "min-w-[84px] px-2.5 py-1.5 text-right whitespace-nowrap",
                                col.isGroupStart && "border-l border-zinc-200",
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => onSort(col.key)}
                                className="inline-flex items-center justify-end gap-1 hover:text-zinc-950 cursor-pointer"
                            >
                                {renderSortIndicator(col.key)}
                                <span>{col.label}</span>
                            </button>
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200 bg-white text-[13px]">
                {rows.length === 0 ? (
                    <tr>
                        <td
                            colSpan={17}
                            className="px-4 py-14 text-center text-xs text-zinc-500"
                        >
                            {totalRegisteredCount === 0
                                ? "No FieldMA instances registered yet. Click Add Instance to register your first deployment."
                                : "No instances match the current search or status filter."}
                        </td>
                    </tr>
                ) : (
                    rows.map((row) => {
                        const isOffline = row.status === "offline";
                        const isDegraded = row.status === "degraded";
                        const isOnline = row.status === "online";
                        const isPolling = pollingInstanceIds.has(
                            row.instance_id,
                        );
                        const missingSet = new Set(row.missing_tables);

                        const statusDotClass = isOnline
                            ? "bg-emerald-500"
                            : isDegraded
                              ? "bg-amber-500"
                              : isOffline
                                ? "bg-rose-500"
                                : "bg-zinc-300";

                        return (
                            <tr
                                key={row.instance_id}
                                className={cn(
                                    "group h-9 transition-colors hover:bg-zinc-50",
                                    isOffline &&
                                        "bg-rose-50/40 hover:bg-rose-50/70",
                                    !row.is_active && "opacity-65",
                                )}
                            >
                                {/* Sticky Left Column: Identity, Status, Latency, Hover Actions */}
                                <td
                                    className={cn(
                                        "sticky left-0 z-10 min-w-[260px] max-w-[280px] border-r border-zinc-200 px-3 py-1",
                                        isOffline
                                            ? "bg-rose-50/90 group-hover:bg-rose-50"
                                            : "bg-white group-hover:bg-zinc-50",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span
                                                        className={cn(
                                                            "h-2 w-2 shrink-0 rounded-full",
                                                            statusDotClass,
                                                        )}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="space-y-0.5 font-mono text-[11px]">
                                                        <div>
                                                            Status:{" "}
                                                            {(
                                                                row.status ??
                                                                "unpolled"
                                                            ).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            Polled:{" "}
                                                            {formatTime(
                                                                row.polled_at,
                                                            )}
                                                        </div>
                                                        {row.error_message && (
                                                            <div className="text-rose-300">
                                                                {row.error_code}
                                                                :{" "}
                                                                {
                                                                    row.error_message
                                                                }
                                                            </div>
                                                        )}
                                                        {row.missing_tables
                                                            .length > 0 && (
                                                            <div className="text-amber-300">
                                                                Missing:{" "}
                                                                {row.missing_tables.join(
                                                                    ", ",
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="truncate font-medium text-zinc-900">
                                                        {row.name}
                                                    </span>
                                                    <a
                                                        href={row.app_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="opacity-0 transition-opacity group-hover:opacity-100 text-zinc-400 hover:text-zinc-800"
                                                        title={row.app_url}
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>

                                                {(isOffline &&
                                                    row.error_code) ||
                                                row.missing_tables.length > 0 ||
                                                !row.is_active ? (
                                                    <div className="flex items-center gap-1.5 font-mono text-[10px] leading-tight">
                                                        {isOffline &&
                                                            row.error_code && (
                                                                <span className="text-rose-600">
                                                                    {
                                                                        row.error_code
                                                                    }
                                                                </span>
                                                            )}
                                                        {row.missing_tables
                                                            .length > 0 && (
                                                            <span className="text-amber-600">
                                                                schema (
                                                                {
                                                                    row
                                                                        .missing_tables
                                                                        .length
                                                                }
                                                                )
                                                            </span>
                                                        )}
                                                        {!row.is_active && (
                                                            <span className="text-zinc-400">
                                                                paused
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1">
                                            {canManage && (
                                                <div className="hidden items-center gap-0.5 group-hover:flex">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        title="Poll Now"
                                                        disabled={isPolling}
                                                        onClick={() =>
                                                            onPollInstance(row)
                                                        }
                                                    >
                                                        {isPolling ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        title="Edit Instance"
                                                        onClick={() =>
                                                            onEditInstance(row)
                                                        }
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        title="Delete Instance"
                                                        onClick={() =>
                                                            onDeleteInstance(
                                                                row,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-3 w-3 text-zinc-500 hover:text-rose-600" />
                                                    </Button>
                                                </div>
                                            )}

                                            <span
                                                className={cn(
                                                    "font-mono text-[11px] tabular-nums group-hover:hidden",
                                                    row.latency_ms === null
                                                        ? "text-zinc-400"
                                                        : row.latency_ms >= 1500
                                                          ? "text-amber-600 font-medium"
                                                          : "text-zinc-500",
                                                )}
                                            >
                                                {row.latency_ms !== null
                                                    ? `${row.latency_ms}ms`
                                                    : "—"}
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* 16 Metric Cells */}
                                {METRIC_COLUMNS.map((col) => {
                                    const value = row.metrics[col.key];
                                    const cellId = `${row.instance_id}:${col.key}`;
                                    const isFlashing =
                                        flashingCells.has(cellId);
                                    const missingForMetric =
                                        col.requiredTables.filter((t) =>
                                            missingSet.has(t),
                                        );

                                    return (
                                        <td
                                            key={col.key}
                                            className={cn(
                                                "px-2.5 py-1 text-right font-mono text-[13px] tabular-nums whitespace-nowrap",
                                                col.isGroupStart &&
                                                    "border-l border-zinc-200",
                                                isFlashing &&
                                                    "animate-cell-flash",
                                                value === null
                                                    ? "text-zinc-400"
                                                    : value === 0
                                                      ? "text-zinc-400"
                                                      : "text-zinc-900",
                                            )}
                                        >
                                            {value === null ? (
                                                missingForMetric.length > 0 &&
                                                !isOffline ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help">
                                                                —
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            Missing table:{" "}
                                                            <span className="font-mono">
                                                                {missingForMetric.join(
                                                                    ", ",
                                                                )}
                                                            </span>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <span>—</span>
                                                )
                                            ) : (
                                                numberFormatter.format(value)
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })
                )}
            </tbody>

            {/* Sticky Bottom Totals Summary Row */}
            <tfoot className="sticky bottom-0 z-20 bg-zinc-100 text-[13px] font-semibold text-zinc-900">
                <tr className="border-t-2 border-zinc-300">
                    <td className="sticky left-0 z-30 border-r border-zinc-200 bg-zinc-100 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span>Total</span>
                            <span className="font-mono text-[11px] font-normal tabular-nums text-zinc-600">
                                {rows.length}{" "}
                                {rows.length === 1 ? "instance" : "instances"}
                            </span>
                        </div>
                    </td>
                    {METRIC_COLUMNS.map((col) => (
                        <td
                            key={col.key}
                            className={cn(
                                "px-2.5 py-2 text-right font-mono text-[13px] tabular-nums whitespace-nowrap",
                                col.isGroupStart && "border-l border-zinc-200",
                            )}
                        >
                            {numberFormatter.format(totals[col.key])}
                        </td>
                    ))}
                </tr>
            </tfoot>
        </table>
    );
}
