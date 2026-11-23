import { Head, router, usePage } from '@inertiajs/react';
import { LogOut, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getEcho, mapPusherState, type RealtimeConnectionState } from '@/lib/echo';
import { cn } from '@/lib/utils';
import type { SharedPageProps } from '@/types/fieldma';

interface DashboardProps {
    today: string;
    selectedDate: string;
    canManage: boolean;
}

export default function Dashboard({ today, selectedDate, canManage }: DashboardProps) {
    const { auth } = usePage<SharedPageProps>().props;
    const [wsState, setWsState] = useState<RealtimeConnectionState>('connecting');

    useEffect(() => {
        const echo = getEcho();
        const connector = echo.connector as unknown as {
            pusher?: {
                connection?: {
                    state: string;
                    bind: (event: string, cb: (states: { current: string }) => void) => void;
                    unbind: (event: string, cb: (states: { current: string }) => void) => void;
                };
            };
        };

        const connection = connector.pusher?.connection;
        if (connection) {
            setWsState(mapPusherState(connection.state));
        }

        const handleStateChange = (states: { current: string }): void => {
            setWsState(mapPusherState(states.current));
        };

        connection?.bind('state_change', handleStateChange);
        echo.private('fieldma.dashboard');

        return () => {
            connection?.unbind('state_change', handleStateChange);
            echo.leave('fieldma.dashboard');
        };
    }, []);

    function handleLogout(): void {
        router.post('/logout');
    }

    const wsLabel =
        wsState === 'connected' ? 'Live' : wsState === 'connecting' ? 'Connecting' : 'Offline';

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900">
                <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold tracking-tight text-zinc-900">
                            FieldMA Central Monitor
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
                        <span className="font-mono text-xs tabular-nums text-zinc-600">
                            {selectedDate}
                            {selectedDate === today ? ' (Today)' : ''}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-zinc-600">
                            <span className="font-medium text-zinc-800">{auth.user?.name}</span>
                            <span className="rounded-sm border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-600">
                                {canManage ? 'admin' : 'viewer'}
                            </span>
                        </div>
                        <Button variant="secondary" size="sm" onClick={handleLogout}>
                            <LogOut className="h-3.5 w-3.5" />
                            Sign Out
                        </Button>
                    </div>
                </header>

                <main className="flex flex-1 items-center justify-center p-6">
                    <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            <Radio className="h-3.5 w-3.5 text-zinc-700" />
                            Phase 1 Console Scaffold Ready
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                            Authentication, role gating, Inertia v2, Tailwind ops tokens, and the private
                            Reverb channel (<span className="font-mono text-xs text-zinc-800">private-fieldma.dashboard</span>)
                            are wired. Next: Phase 2 Instance Registry CRUD and Test Connection.
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}
