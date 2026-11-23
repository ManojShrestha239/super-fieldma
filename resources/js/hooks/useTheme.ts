import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'fieldma-theme';

function getInitialTheme(): ThemeMode {
    if (typeof document === 'undefined') {
        return 'light';
    }
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme(): {
    theme: ThemeMode;
    toggleTheme: () => void;
    setTheme: (next: ThemeMode) => void;
} {
    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

    const applyTheme = useCallback((next: ThemeMode): void => {
        setThemeState(next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Ignore storage restrictions
        }
    }, []);

    const toggleTheme = useCallback((): void => {
        applyTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, applyTheme]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    return {
        theme,
        toggleTheme,
        setTheme: applyTheme,
    };
}
