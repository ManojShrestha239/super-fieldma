import { Head, router, usePage } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    LogOut,
    Plus,
    RefreshCw,
    Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    METRIC_COLUMNS,
    MetricsTable,
    type SortDirection,
    type SortKey,
} from '@/components/dashboard/MetricsTable';
import { DeleteInstanceDialog } from '@/components/instances/DeleteInstanceDialog';
import { InstanceDrawer } from '@/components/instances/InstanceDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFieldmaRealtime } from '@/hooks/useFieldmaRealtime';
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
    rows: initialRows,
}: DashboardProps) {
    const { auth, flash } = usePage<SharedPageProps>().props;
    const [rows, setRows] = useState<DashboardRow[]>(initialRows);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

    // Keep local rows synchronized when Inertia navigates dates or reloads after CRUD
    useEffect(() => {
        setRows(initialRows);
    }, [initialRows]);

    // Clean up all pending flash timers on unmount
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
            { preserveState: true, preserveScroll: true, only: ['rows', 'selectedDate', 'today'] },
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
            <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900">
                <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3">
                    {/* Left: Title, Live Status, Date Stepper */}
                    <div className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold tracking-tight text-zinc-900 whitespace-nowrap">
                            FieldMA Monitor
                        </span>

                        <span className="h-4 w-px bg-zinc-200" aria-hidden="true" />

                        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
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

                        <span className="h-4 w-px bg-zinc-200" aria-hidden="true" />

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
                                className="h-7 rounded-md border border-zinc-200 bg-white px-2 font-mono text-xs tabular-nums text-zinc-800 focus:border-zinc-400 focus:outline-none"
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
                                    <span className="hidden rounded-sm border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 xl:inline">
                                        Historical · Live Paused
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: Search, Status Pills, Actions */}
                    <div className="flex items-center gap-2">
                        <div className="relative w-48 xl:w-56">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                            <Input
                                ref={searchInputRef}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter instances... (/)"
                                className="h-7 pl-8 text-xs"
                            />
                        </div>

                        <div className="hidden items-center rounded-md border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] lg:flex">
                            {(
                                [
                                    ['all', `All (${statusCounts.all})`],
                                    ['online', `Online (${statusCounts.online})`],
                                    ['degraded', `Degraded (${statusCounts.degraded})`],
                                    ['offline', `Offline (${statusCounts.offline})`],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setStatusFilter(key)}
                                    className={cn(
                                        'rounded-sm px-2 py-0.5 font-medium tabular-nums transition-colors cursor-pointer',
                                        statusFilter === key
                                            ? 'border border-zinc-200 bg-white text-zinc-900'
                                            : 'border border-transparent text-zinc-600 hover:text-zinc-900',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {canManage && (
                            <>
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
                                <Button size="sm" onClick={openCreateDrawer}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Instance
                                </Button>
                            </>
                        )}

                        <span className="h-4 w-px bg-zinc-200" aria-hidden="true" />

                        <Button
                            variant="ghost"
                            size="sm"
                            title={`Signed in as ${auth.user?.email ?? ''}`}
                            onClick={handleLogout}
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </header>

                {flash.success && (
                    <div className="border-b border-zinc-200 bg-zinc-100/80 px-4 py-1 text-xs text-zinc-700">
                        {flash.success}
                    </div>
                )}

                <main className="flex-1 overflow-auto">
                    <MetricsTable
                        rows={filteredAndSortedRows}
                        totalRegisteredCount={rows.length}
                        canManage={canManage}
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
