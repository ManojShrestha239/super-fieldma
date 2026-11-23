import { Head, router, usePage } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    LogOut,
    Moon,
    Plus,
    RefreshCw,
    Rows2,
    Rows3,
    Search,
    Sun,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    METRIC_COLUMNS,
    MetricsTable,
    type SortDirection,
    type SortKey,
    type TableDensity,
} from '@/components/dashboard/MetricsTable';
import { DeleteInstanceDialog } from '@/components/instances/DeleteInstanceDialog';
import { InstanceDrawer } from '@/components/instances/InstanceDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFieldmaRealtime } from '@/hooks/useFieldmaRealtime';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type {
    DashboardRow,
    FieldmaInstanceItem,
    FieldmaMetricsUpdatedPayload,
    SharedPageProps,
} from '@/types/fieldma';

interface DashboardProps {
    today: string;
    selectedDate: string;
    canManage: boolean;
    backfillingCount: number;
    rows: DashboardRow[];
}

type StatusFilter = 'all' | 'online' | 'degraded' | 'offline';

function getCsrfToken(): string {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return meta?.content ?? '';
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + deltaDays));
    return date.toISOString().slice(0, 10);
}

function rowToInstanceItem(row: DashboardRow): FieldmaInstanceItem {
    return {
        id: row.instance_id,
        name: row.name,
        slug: row.slug,
        app_url: row.app_url,
        db_ip: row.db_ip,
        db_port: row.db_port,
        db_database: row.db_database,
        db_user: row.db_user,
        is_active: row.is_active,
        notes: row.notes,
        last_tested_at: row.polled_at,
        last_test_ok: row.status !== null ? row.status !== 'offline' : null,
        last_latency_ms: row.latency_ms,
        created_at: null,
        updated_at: null,
    };
}

export default function Dashboard({
    today,
    selectedDate,
    canManage,
    backfillingCount,
    rows: initialRows,
}: DashboardProps) {
    const { auth, flash } = usePage<SharedPageProps>().props;
    const { theme, toggleTheme } = useTheme();
    const [rows, setRows] = useState<DashboardRow[]>(initialRows);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [density, setDensity] = useState<TableDensity>('comfortable');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingInstance, setEditingInstance] = useState<FieldmaInstanceItem | null>(null);
    const [deletingInstance, setDeletingInstance] = useState<FieldmaInstanceItem | null>(null);
    const [pollingAll, setPollingAll] = useState(false);
    const [pollingInstanceIds, setPollingInstanceIds] = useState<Set<number>>(new Set());
    const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        setRows(initialRows);
    }, [initialRows]);

    useEffect(() => {
        const timers = flashTimersRef.current;
        return () => {
            for (const timer of timers.values()) {
                clearTimeout(timer);
            }
            timers.clear();
        };
    }, []);

    const handleMetricsUpdated = useCallback((payload: FieldmaMetricsUpdatedPayload): void => {
        const changedCellIds: string[] = [];

        setRows((prevRows) =>
            prevRows.map((row) => {
                if (row.instance_id !== payload.instance_id) {
                    return row;
                }

                for (const col of METRIC_COLUMNS) {
                    if (row.metrics[col.key] !== payload.metrics[col.key]) {
                        changedCellIds.push(`${row.instance_id}:${col.key}`);
                    }
                }

                return {
                    ...row,
                    status: payload.status,
                    latency_ms: payload.latency_ms,
                    polled_at: payload.polled_at,
                    error_code: payload.error_code,
                    error_message: payload.error_message,
                    missing_tables: payload.missing_tables,
                    metrics: payload.metrics,
                };
            }),
        );

        setPollingInstanceIds((prev) => {
            if (!prev.has(payload.instance_id)) {
                return prev;
            }
            const next = new Set(prev);
            next.delete(payload.instance_id);
            return next;
        });

        if (changedCellIds.length > 0) {
            setFlashingCells((prev) => {
                const next = new Set(prev);
                for (const id of changedCellIds) {
                    next.add(id);
                }
                return next;
            });

            for (const cellId of changedCellIds) {
                const existing = flashTimersRef.current.get(cellId);
                if (existing) {
                    clearTimeout(existing);
                }
                const timer = setTimeout(() => {
                    setFlashingCells((prev) => {
                        const next = new Set(prev);
                        next.delete(cellId);
                        return next;
                    });
                    flashTimersRef.current.delete(cellId);
                }, 600);
                flashTimersRef.current.set(cellId, timer);
            }
        }
    }, []);

    const wsState = useFieldmaRealtime({
        selectedDate,
        onMetricsUpdated: handleMetricsUpdated,
    });

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (
                event.key === '/' &&
                !drawerOpen &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA'
            ) {
                event.preventDefault();
                searchInputRef.current?.focus();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [drawerOpen]);

    const statusCounts = useMemo(() => {
        let online = 0;
        let degraded = 0;
        let offline = 0;
        for (const row of rows) {
            if (row.status === 'online') {
                online += 1;
            } else if (row.status === 'degraded') {
                degraded += 1;
            } else if (row.status === 'offline') {
                offline += 1;
            }
        }
        return { all: rows.length, online, degraded, offline };
    }, [rows]);

    const filteredAndSortedRows = useMemo(() => {
        const q = search.trim().toLowerCase();

        const filtered = rows.filter((row) => {
            if (statusFilter !== 'all' && row.status !== statusFilter) {
                return false;
            }
            if (q === '') {
                return true;
            }
            return (
                row.name.toLowerCase().includes(q) ||
                row.slug.toLowerCase().includes(q) ||
                row.db_ip.toLowerCase().includes(q) ||
                row.db_database.toLowerCase().includes(q) ||
                (row.notes ?? '').toLowerCase().includes(q)
            );
        });

        const dir = sortDirection === 'asc' ? 1 : -1;

        return [...filtered].sort((a, b) => {
            if (sortKey === 'name') {
                return a.name.localeCompare(b.name) * dir;
            }
            if (sortKey === 'latency_ms') {
                const aVal = a.latency_ms ?? -1;
                const bVal = b.latency_ms ?? -1;
                return (aVal - bVal) * dir;
            }
            const aMetric = a.metrics[sortKey] ?? -1;
            const bMetric = b.metrics[sortKey] ?? -1;
            return (aMetric - bMetric) * dir;
        });
    }, [rows, search, statusFilter, sortKey, sortDirection]);

    function handleSort(key: SortKey): void {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDirection(key === 'name' ? 'asc' : 'desc');
        }
    }

    function navigateDate(nextDate: string): void {
        router.get(
            '/',
            nextDate === today ? {} : { date: nextDate },
            {
                preserveState: true,
                preserveScroll: true,
                only: ['rows', 'selectedDate', 'today', 'backfillingCount'],
            },
        );
    }

    async function handlePollAll(): Promise<void> {
        setPollingAll(true);
        try {
            await fetch('/dashboard/poll-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({ date: selectedDate }),
            });
        } finally {
            setTimeout(() => setPollingAll(false), 600);
        }
    }

    async function handlePollInstance(row: DashboardRow): Promise<void> {
        setPollingInstanceIds((prev) => new Set(prev).add(row.instance_id));
        try {
            await fetch(`/instances/${row.instance_id}/poll`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({ date: selectedDate }),
            });
        } catch {
            setPollingInstanceIds((prev) => {
                const next = new Set(prev);
                next.delete(row.instance_id);
                return next;
            });
        }
    }

    function openCreateDrawer(): void {
        setEditingInstance(null);
        setDrawerOpen(true);
    }

    function openEditDrawer(row: DashboardRow): void {
        setEditingInstance(rowToInstanceItem(row));
        setDrawerOpen(true);
    }

    function openDeleteDialog(row: DashboardRow): void {
        setDeletingInstance(rowToInstanceItem(row));
    }

    function handleLogout(): void {
        router.post('/logout');
    }

    const isHistorical = selectedDate !== today;
    const wsLabel =
        wsState === 'connected' ? 'Live' : wsState === 'connecting' ? 'Reconnecting' : 'Offline';

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                {/* Primary Top Bar */}
                <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span
                                className="h-2.5 w-2.5 rounded-sm bg-zinc-900 dark:bg-zinc-100"
                                aria-hidden="true"
                            />
                            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                                FieldMA Central Monitor
                            </span>
                        </div>

                        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 cursor-default">
                                    <span
                                        className={cn(
                                            'h-2 w-2 rounded-full',
                                            wsState === 'connected' && 'bg-emerald-500',
                                            wsState === 'connecting' && 'bg-amber-500',
                                            wsState === 'disconnected' && 'bg-rose-500',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="font-mono text-[11px]">{wsLabel}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {wsState === 'connected'
                                    ? 'Connected to Laravel Reverb for live metric updates'
                                    : wsState === 'connecting'
                                      ? 'Reconnecting to Reverb WebSocket server...'
                                      : 'WebSocket offline. Updates will resume automatically once Reverb is reachable.'}
                            </TooltipContent>
                        </Tooltip>

                        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />

                        {/* Date Selector */}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="secondary"
                                size="icon"
                                title="Previous Day"
                                onClick={() => navigateDate(shiftIsoDate(selectedDate, -1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <input
                                type="date"
                                value={selectedDate}
                                max={today}
                                onChange={(e) => e.target.value && navigateDate(e.target.value)}
                                className="h-7 rounded-md border border-zinc-200 bg-white px-2 font-mono text-xs tabular-nums text-zinc-800 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-zinc-600"
                            />
                            <Button
                                variant="secondary"
                                size="icon"
                                title="Next Day"
                                disabled={selectedDate >= today}
                                onClick={() => navigateDate(shiftIsoDate(selectedDate, 1))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                            {isHistorical && (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => navigateDate(today)}
                                    >
                                        Today
                                    </Button>
                                    {backfillingCount > 0 && rows.some((r) => r.is_active && r.status === null) ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Fetching {selectedDate}...
                                        </span>
                                    ) : (
                                        <span className="hidden rounded-sm border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 xl:inline">
                                            Historical · Saved locally
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Utility Controls */}
                    <div className="flex items-center gap-2">
                        {canManage && (
                            <>
                                {!isHistorical && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={pollingAll}
                                        onClick={handlePollAll}
                                    >
                                        {pollingAll ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        )}
                                        Poll All
                                    </Button>
                                )}
                                <Button size="sm" onClick={openCreateDrawer}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Instance
                                </Button>
                            </>
                        )}

                        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    onClick={() =>
                                        setDensity((prev) =>
                                            prev === 'comfortable' ? 'compact' : 'comfortable',
                                        )
                                    }
                                    aria-label="Toggle table row density"
                                >
                                    {density === 'comfortable' ? (
                                        <Rows3 className="h-3.5 w-3.5" />
                                    ) : (
                                        <Rows2 className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {density === 'comfortable'
                                    ? 'Switch to compact density'
                                    : 'Switch to comfortable density'}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    onClick={toggleTheme}
                                    aria-label={
                                        theme === 'dark'
                                            ? 'Switch to light mode'
                                            : 'Switch to dark mode'
                                    }
                                >
                                    {theme === 'dark' ? (
                                        <Sun className="h-3.5 w-3.5" />
                                    ) : (
                                        <Moon className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleLogout}
                                    aria-label="Sign out"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Sign out ({auth.user?.email ?? ''})</TooltipContent>
                        </Tooltip>
                    </div>
                </header>

                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="relative w-full max-w-xs">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                        <Input
                            ref={searchInputRef}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search instance, slug, or database... (/)"
                            className="h-7 pl-8 pr-7 text-xs"
                        />
                        {search !== '' && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center rounded-md border border-zinc-200 bg-white p-0.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
                        {(
                            [
                                { key: 'all', label: 'All', count: statusCounts.all, dot: null },
                                {
                                    key: 'online',
                                    label: 'Online',
                                    count: statusCounts.online,
                                    dot: 'bg-emerald-500',
                                },
                                {
                                    key: 'degraded',
                                    label: 'Degraded',
                                    count: statusCounts.degraded,
                                    dot: 'bg-amber-500',
                                },
                                {
                                    key: 'offline',
                                    label: 'Offline',
                                    count: statusCounts.offline,
                                    dot: 'bg-rose-500',
                                },
                            ] as const
                        ).map((pill) => (
                            <button
                                key={pill.key}
                                type="button"
                                onClick={() => setStatusFilter(pill.key)}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-medium tabular-nums transition-colors cursor-pointer',
                                    statusFilter === pill.key
                                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                                )}
                            >
                                {pill.dot && (
                                    <span
                                        className={cn('h-1.5 w-1.5 rounded-full', pill.dot)}
                                        aria-hidden="true"
                                    />
                                )}
                                <span>{pill.label}</span>
                                <span
                                    className={cn(
                                        'font-mono text-[10px]',
                                        statusFilter === pill.key
                                            ? 'opacity-80'
                                            : 'text-zinc-400 dark:text-zinc-500',
                                    )}
                                >
                                    {pill.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {flash.success && (
                    <div className="border-b border-zinc-200 bg-zinc-100/90 px-4 py-1.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                        {flash.success}
                    </div>
                )}

                <main className="flex-1 overflow-auto">
                    <MetricsTable
                        rows={filteredAndSortedRows}
                        totalRegisteredCount={rows.length}
                        canManage={canManage}
                        isHistorical={isHistorical}
                        density={density}
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        flashingCells={flashingCells}
                        pollingInstanceIds={pollingInstanceIds}
                        onPollInstance={handlePollInstance}
                        onEditInstance={openEditDrawer}
                        onDeleteInstance={openDeleteDialog}
                    />
                </main>
            </div>

            {canManage && (
                <>
                    <InstanceDrawer
                        open={drawerOpen}
                        onOpenChange={setDrawerOpen}
                        instance={editingInstance}
                    />
                    <DeleteInstanceDialog
                        instance={deletingInstance}
                        onClose={() => setDeletingInstance(null)}
                    />
                </>
            )}
        </>
    );
}
