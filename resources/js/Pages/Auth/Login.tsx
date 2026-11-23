import { Head, useForm } from '@inertiajs/react';
import { Moon, Sun } from 'lucide-react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/hooks/useTheme';

interface LoginFormData {
    email: string;
    password: string;
    remember: boolean;
}

export default function Login() {
    const { theme, toggleTheme } = useTheme();
    const { data, setData, post, processing, errors } = useForm<LoginFormData>({
        email: '',
        password: '',
        remember: false,
    });

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        post('/login');
    }

    return (
        <>
            <Head title="Sign In" />
            <main className="relative flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
                <div className="absolute right-4 top-4">
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? (
                            <Sun className="h-3.5 w-3.5" />
                        ) : (
                            <Moon className="h-3.5 w-3.5" />
                        )}
                    </Button>
                </div>

                <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                            <span
                                className="h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
                                aria-hidden="true"
                            />
                            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                                FieldMA Central Monitor
                            </h1>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Internal operations console. Sign in with your provisioned account.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" noValidate>
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="username"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="admin@fieldma.local"
                                required
                                autoFocus
                            />
                            {errors.email && (
                                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                required
                            />
                            {errors.password && (
                                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 select-none cursor-pointer">
                            <input
                                type="checkbox"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="h-3.5 w-3.5 rounded-sm border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 focus:ring-zinc-400"
                            />
                            Keep session active
                        </label>

                        <Button type="submit" className="w-full" disabled={processing}>
                            {processing ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>
                </div>
            </main>
        </>
    );
}
