import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';

interface PageModule {
    default: ComponentType;
}

const appName = import.meta.env.VITE_APP_NAME || 'FieldMA Central Monitor';

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),
    resolve: (name) => {
        const pages = import.meta.glob<PageModule>('./Pages/**/*.tsx', { eager: true });
        const page = pages[`./Pages/${name}.tsx`];
        if (!page) {
            throw new Error(`Inertia page not found: ${name}`);
        }
        return page.default;
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <TooltipProvider delayDuration={200}>
                <App {...props} />
            </TooltipProvider>,
        );
    },
    progress: {
        color: '#18181b',
        showSpinner: false,
    },
});
