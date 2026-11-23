import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

export type RealtimeConnectionState = 'connected' | 'connecting' | 'disconnected';

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo?: Echo<'reverb'>;
    }
}

window.Pusher = Pusher;

let echoInstance: Echo<'reverb'> | null = null;

function resolveCsrfToken(): string {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return meta?.content ?? '';
}

export function getEcho(): Echo<'reverb'> {
    if (echoInstance !== null) {
        return echoInstance;
    }

    const scheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http';
    const isTls = scheme === 'https';
    const port = Number(import.meta.env.VITE_REVERB_PORT ?? (isTls ? 443 : 8080));

    echoInstance = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY ?? '',
        wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
        wsPort: port,
        wssPort: port,
        forceTLS: isTls,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: '/broadcasting/auth',
        auth: {
            headers: {
                'X-CSRF-TOKEN': resolveCsrfToken(),
            },
        },
    });

    window.Echo = echoInstance;

    return echoInstance;
}

export function mapPusherState(state: string): RealtimeConnectionState {
    if (state === 'connected') {
        return 'connected';
    }
    if (state === 'connecting' || state === 'initialized') {
        return 'connecting';
    }
    return 'disconnected';
}
