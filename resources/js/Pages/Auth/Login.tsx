import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginFormData {
    email: string;
    password: string;
    remember: boolean;
}

export default function Login() {
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
            <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
                <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6">
                    <div className="border-b border-zinc-200 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-zinc-900" aria-hidden="true" />
                            <h1 className="text-sm font-semibold tracking-tight text-zinc-900">
                                FieldMA Central Monitor
                            </h1>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
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
                                <p className="text-[11px] font-medium text-rose-600">{errors.email}</p>
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
                                <p className="text-[11px] font-medium text-rose-600">{errors.password}</p>
                            )}
                        </div>

                        <label className="flex items-center gap-2 text-xs text-zinc-600 select-none cursor-pointer">
                            <input
                                type="checkbox"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="h-3.5 w-3.5 rounded-sm border-zinc-300 text-zinc-900 focus:ring-zinc-400"
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
