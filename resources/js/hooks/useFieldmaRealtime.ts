import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { getEcho, mapPusherState, type RealtimeConnectionState } from '@/lib/echo';
import type { FieldmaMetricsUpdatedPayload } from '@/types/fieldma';

interface UseFieldmaRealtimeOptions {
    selectedDate: string;
    onMetricsUpdated: (payload: FieldmaMetricsUpdatedPayload) => void;
}

export function useFieldmaRealtime({
    selectedDate,
    onMetricsUpdated,
}: UseFieldmaRealtimeOptions): RealtimeConnectionState {
    const [wsState, setWsState] = useState<RealtimeConnectionState>('connecting');
    const selectedDateRef = useRef(selectedDate);
    const onMetricsUpdatedRef = useRef(onMetricsUpdated);
    const hasConnectedOnceRef = useRef(false);

    useEffect(() => {
        selectedDateRef.current = selectedDate;
    }, [selectedDate]);

    useEffect(() => {
        onMetricsUpdatedRef.current = onMetricsUpdated;
    }, [onMetricsUpdated]);

    useEffect(() => {
        const echo = getEcho();
        const connector = echo.connector as unknown as {
            pusher?: {
                connection?: {
                    state: string;
                    bind: (
                        event: string,
                        cb: (states: { previous: string; current: string }) => void,
                    ) => void;
                    unbind: (
                        event: string,
                        cb: (states: { previous: string; current: string }) => void,
                    ) => void;
                };
            };
        };

        const connection = connector.pusher?.connection;
        if (connection) {
            const initial = mapPusherState(connection.state);
            setWsState(initial);
            if (initial === 'connected') {
                hasConnectedOnceRef.current = true;
            }
        }

        const handleStateChange = (states: { previous: string; current: string }): void => {
            const next = mapPusherState(states.current);
            setWsState(next);

            if (next === 'connected') {
                if (hasConnectedOnceRef.current && states.previous !== 'connected') {
                    router.reload({ only: ['rows'] });
                }
                hasConnectedOnceRef.current = true;
            }
        };

        connection?.bind('state_change', handleStateChange);

        const channel = echo.private('fieldma.dashboard');
        channel.listen('.metrics.updated', (payload: FieldmaMetricsUpdatedPayload) => {
            if (payload.snapshot_date !== selectedDateRef.current) {
                return;
            }
            onMetricsUpdatedRef.current(payload);
        });

        return () => {
            connection?.unbind('state_change', handleStateChange);
            channel.stopListening('.metrics.updated');
            echo.leave('fieldma.dashboard');
        };
    }, []);

    return wsState;
}
