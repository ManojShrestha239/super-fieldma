import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    Loader2,
    Pencil,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DashboardRow, FieldmaMetrics } from '@/types/fieldma';

export type MetricKey = keyof FieldmaMetrics;
export type SortKey = 'name' | 'latency_ms' | MetricKey;
export type SortDirection = 'asc' | 'desc';
export type TableDensity = 'comfortable' | 'compact';

interface MetricColumnDef {
    key: MetricKey;
    label: string;
    description: string;
    group: 'users' | 'visits' | 'finance' | 'activity';
    requiredTables: readonly string[];
    isGroupStart?: boolean;
}

export const METRIC_COLUMNS: readonly MetricColumnDef[] = [
    // Group 1: Users & Attendance
    {
        key: 'users_count',
        label: 'Users',
        description: 'Total registered mobile users',
        group: 'users',
        requiredTables: ['mobileusers'],
        isGroupStart: true,
    },
    {
        key: 'login_users_count',
        label: 'Logins',
        description: 'Unique users logged in on selected date',
        group: 'users',
        requiredTables: ['device_logs', 'mobileusers'],
    },
    {
        key: 'checked_in_users_count',
        label: 'Check-In',
        description: 'Unique users checked in on selected date',
        group: 'users',
        requiredTables: ['attendance_statuses'],
    },
    {
        key: 'checked_out_users_count',
        label: 'Check-Out',
        description: 'Unique users checked out on selected date',
        group: 'users',
        requiredTables: ['attendance_statuses'],
    },

    // Group 2: Visits
    {
        key: 'online_visits_count',
        label: 'Online',
        description: 'Online visits recorded on selected date',
        group: 'visits',
        requiredTables: ['visits'],
        isGroupStart: true,
    },
    {
        key: 'offline_visits_count',
        label: 'Offline',
        description: 'Offline visits synced on selected date',
        group: 'visits',
        requiredTables: ['visits'],
    },
    {
        key: 'unlisted_visits_count',
        label: 'Unlisted',
        description: 'Unlisted visits recorded on selected date',
        group: 'visits',
        requiredTables: ['visits'],
    },
    {
        key: 'scheduled_visits_users_count',
        label: 'Scheduled',
        description: 'Unique users with scheduled visits (1 per user)',
        group: 'visits',
        requiredTables: ['schedulevisits'],
    },

    // Group 3: Orders & Finance
    {
        key: 'orders_count',
        label: 'Orders',
        description: 'Total orders created on selected date',
        group: 'finance',
        requiredTables: ['orders'],
        isGroupStart: true,
    },
    {
        key: 'collections_count',
        label: 'Collections',
        description: 'Total payment collections on selected date',
        group: 'finance',
        requiredTables: ['payments'],
    },
    {
        key: 'daily_reports_count',
        label: 'Reports',
        description: 'Active daily TADA reports (excluding deleted)',
        group: 'finance',
        requiredTables: ['tada_entries'],
    },
    {
        key: 'expense_entries_count',
        label: 'Expenses',
        description: 'Combined dealer + other expense entries',
        group: 'finance',
        requiredTables: ['tada_dealer_expenses', 'tada_other_expenses'],
    },

    // Group 4: Field Activity
    {
        key: 'gps_tracked_users_count',
        label: 'GPS (1/u)',
        description: 'Unique users with GPS locations tracked (1 per user)',
        group: 'activity',
        requiredTables: ['locations'],
        isGroupStart: true,
    },
    {
        key: 'messages_users_count',
        label: 'Msgs (1/u)',
        description: 'Unique users who sent messages (1 per user)',
        group: 'activity',
        requiredTables: ['messages'],
    },
    {
        key: 'site_registrations_count',
        label: 'Site Regs',
        description: 'Site registrations created on selected date',
        group: 'activity',
        requiredTables: ['v2_site_registrations', 'site_registration_v2_s'],
    },
    {
        key: 'notices_count',
        label: 'Notices',
        description: 'Notices published on selected date',
        group: 'activity',
        requiredTables: ['notices'],
    },
];

const numberFormatter = new Intl.NumberFormat('en-US');

interface MetricsTableProps {
    rows: DashboardRow[];
    totalRegisteredCount: number;
    canManage: boolean;
    density: TableDensity;
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
        return 'Not polled';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return date.toLocaleTimeString('en-GB', { hour12: false });
}

export function MetricsTable({
    rows,
    totalRegisteredCount,
    canManage,
    density,
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
                if (typeof value === 'number') {
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
        return sortDirection === 'asc' ? (
            <ArrowUp className="inline h-3 w-3 text-zinc-900 dark:text-zinc-100" />
        ) : (
            <ArrowDown className="inline h-3 w-3 text-zinc-900 dark:text-zinc-100" />
        );
    }

    const rowHeightClass = density === 'comfortable' ? 'h-11' : 'h-9';
    const cellPaddingClass = density === 'comfortable' ? 'px-3 py-2' : 'px-2.5 py-1';

    return (
        <table className="w-max min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                {/* Tier 1: Column Group Headers */}
                <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th
                        rowSpan={2}
                        className="sticky left-0 z-30 min-w-[290px] max-w-[320px] border-b border-r border-zinc-300 bg-zinc-100 px-3.5 py-2 align-bottom dark:border-zinc-700 dark:bg-zinc-900"
                    >
                        <div className="flex items-center justify-between gap-2 text-xs font-medium normal-case tracking-normal text-zinc-700 dark:text-zinc-300">
                            <button
                                type="button"
                                onClick={() => onSort('name')}
                                className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                            >
                                Instance {renderSortIndicator('name')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onSort('latency_ms')}
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                            >
                                Latency {renderSortIndicator('latency_ms')}
                            </button>
                        </div>
                    </th>
                    <th colSpan={4} className="border-l border-zinc-200 px-2.5 py-1.5 text-center dark:border-zinc-800">
                        Users &amp; Attendance
                    </th>
                    <th colSpan={4} className="border-l border-zinc-200 px-2.5 py-1.5 text-center dark:border-zinc-800">
                        Visits
                    </th>
                    <th colSpan={4} className="border-l border-zinc-200 px-2.5 py-1.5 text-center dark:border-zinc-800">
                        Orders &amp; Finance
                    </th>
                    <th colSpan={4} className="border-l border-zinc-200 px-2.5 py-1.5 text-center dark:border-zinc-800">
                        Field Activity
                    </th>
                </tr>

                {/* Tier 2: Individual Metric Headers */}
                <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    {METRIC_COLUMNS.map((col) => (
                        <th
                            key={col.key}
                            className={cn(
                                'min-w-[88px] px-2.5 py-2 text-right whitespace-nowrap',
                                col.isGroupStart && 'border-l border-zinc-200 dark:border-zinc-800',
                            )}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => onSort(col.key)}
                                        className="inline-flex items-center justify-end gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                                    >
                                        {renderSortIndicator(col.key)}
                                        <span>{col.label}</span>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>{col.description}</TooltipContent>
                            </Tooltip>
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200 bg-white text-[13px] dark:divide-zinc-800/80 dark:bg-zinc-950">
                {rows.length === 0 ? (
                    <tr>
                        <td
                            colSpan={17}
                            className="px-4 py-16 text-center text-xs text-zinc-500 dark:text-zinc-400"
                        >
                            {totalRegisteredCount === 0
                                ? 'No FieldMA instances registered yet. Click Add Instance to register your first deployment.'
                                : 'No instances match the current search or status filter.'}
                        </td>
                    </tr>
                ) : (
                    rows.map((row) => {
                        const isOffline = row.status === 'offline';
                        const isDegraded = row.status === 'degraded';
                        const isOnline = row.status === 'online';
                        const isPolling = pollingInstanceIds.has(row.instance_id);
                        const missingSet = new Set(row.missing_tables);

                        const statusDotClass = isOnline
                            ? 'bg-emerald-500'
                            : isDegraded
                              ? 'bg-amber-500'
                              : isOffline
                                ? 'bg-rose-500'
                                : 'bg-zinc-300 dark:bg-zinc-600';

                        return (
                            <tr
                                key={row.instance_id}
                                className={cn(
                                    'group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/70',
                                    rowHeightClass,
                                    isOffline &&
                                        'bg-rose-50/40 hover:bg-rose-50/75 dark:bg-rose-950/20 dark:hover:bg-rose-950/35',
                                    !row.is_active && 'opacity-60',
                                )}
                            >
                                {/* Sticky Left Column */}
                                <td
                                    className={cn(
                                        'sticky left-0 z-10 min-w-[290px] max-w-[320px] border-r border-zinc-200 px-3.5 py-1.5 dark:border-zinc-800',
                                        isOffline
                                            ? 'bg-rose-50/90 group-hover:bg-rose-50 dark:bg-zinc-950 dark:group-hover:bg-rose-950/40'
                                            : 'bg-white group-hover:bg-zinc-50 dark:bg-zinc-950 dark:group-hover:bg-zinc-900',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span
                                                        className={cn(
                                                            'h-2 w-2 shrink-0 rounded-full',
                                                            statusDotClass,
                                                        )}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="space-y-0.5 font-mono text-[11px]">
                                                        <div>
                                                            Status: {(row.status ?? 'unpolled').toUpperCase()}
                                                        </div>
                                                        <div>DB: {row.db_database}</div>
                                                        <div>Polled: {formatTime(row.polled_at)}</div>
                                                        {row.error_message && (
                                                            <div className="text-rose-300">
                                                                {row.error_code}: {row.error_message}
                                                            </div>
                                                        )}
                                                        {row.missing_tables.length > 0 && (
                                                            <div className="text-amber-300">
                                                                Missing: {row.missing_tables.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                                                        {row.name}
                                                    </span>
                                                    <a
                                                        href={row.app_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-zinc-400 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200"
                                                        title={`Open ${row.app_url}`}
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>

                                                {(isOffline && row.error_code) ||
                                                row.missing_tables.length > 0 ||
                                                !row.is_active ? (
                                                    <div className="flex items-center gap-1.5 font-mono text-[10px] leading-tight">
                                                        {isOffline && row.error_code && (
                                                            <span className="text-rose-600 dark:text-rose-400">
                                                                {row.error_code}
                                                            </span>
                                                        )}
                                                        {row.missing_tables.length > 0 && (
                                                            <span className="text-amber-600 dark:text-amber-400">
                                                                schema ({row.missing_tables.length})
                                                            </span>
                                                        )}
                                                        {!row.is_active && (
                                                            <span className="text-zinc-400 dark:text-zinc-500">
                                                                paused
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <span
                                                className={cn(
                                                    'font-mono text-[11px] tabular-nums',
                                                    row.latency_ms === null
                                                        ? 'text-zinc-400 dark:text-zinc-600'
                                                        : row.latency_ms >= 1500
                                                          ? 'font-medium text-amber-600 dark:text-amber-400'
                                                          : 'text-zinc-500 dark:text-zinc-400',
                                                )}
                                            >
                                                {row.latency_ms !== null ? `${row.latency_ms}ms` : '—'}
                                            </span>

                                            {canManage && (
                                                <div className="flex items-center gap-0.5 border-l border-zinc-200 pl-1.5 opacity-60 transition-opacity group-hover:opacity-100 dark:border-zinc-800">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        title="Poll Now"
                                                        disabled={isPolling}
                                                        onClick={() => onPollInstance(row)}
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
                                                        onClick={() => onEditInstance(row)}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        title="Delete Instance"
                                                        onClick={() => onDeleteInstance(row)}
                                                    >
                                                        <Trash2 className="h-3 w-3 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                {/* 16 Metric Cells */}
                                {METRIC_COLUMNS.map((col) => {
                                    const value = row.metrics[col.key];
                                    const cellId = `${row.instance_id}:${col.key}`;
                                    const isFlashing = flashingCells.has(cellId);
                                    const missingForMetric = col.requiredTables.filter((t) =>
                                        missingSet.has(t),
                                    );

                                    return (
                                        <td
                                            key={col.key}
                                            className={cn(
                                                'text-right font-mono text-[13px] tabular-nums whitespace-nowrap',
                                                cellPaddingClass,
                                                col.isGroupStart && 'border-l border-zinc-200 dark:border-zinc-800',
                                                isFlashing && 'animate-cell-flash',
                                                value === null
                                                    ? 'text-zinc-400 dark:text-zinc-600'
                                                    : value === 0
                                                      ? 'text-zinc-400 dark:text-zinc-600'
                                                      : 'text-zinc-900 dark:text-zinc-100',
                                            )}
                                        >
                                            {value === null ? (
                                                missingForMetric.length > 0 && !isOffline ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help">—</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            Missing table:{' '}
                                                            <span className="font-mono">
                                                                {missingForMetric.join(', ')}
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
            <tfoot className="sticky bottom-0 z-20 bg-zinc-100 text-[13px] font-semibold text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                <tr className="border-t-2 border-zinc-300 dark:border-zinc-700">
                    <td className="sticky left-0 z-30 border-r border-zinc-200 bg-zinc-100 px-3.5 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex items-center justify-between">
                            <span>Total</span>
                            <span className="font-mono text-[11px] font-normal tabular-nums text-zinc-600 dark:text-zinc-400">
                                {rows.length} {rows.length === 1 ? 'instance' : 'instances'}
                            </span>
                        </div>
                    </td>
                    {METRIC_COLUMNS.map((col) => (
                        <td
                            key={col.key}
                            className={cn(
                                'px-2.5 py-2.5 text-right font-mono text-[13px] tabular-nums whitespace-nowrap',
                                col.isGroupStart && 'border-l border-zinc-200 dark:border-zinc-800',
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
