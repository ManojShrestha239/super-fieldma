import { useForm } from '@inertiajs/react';
import { Loader2, PlugZap } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { FieldmaInstanceItem, TestConnectionResult } from '@/types/fieldma';

interface InstanceFormData {
    name: string;
    slug: string;
    app_url: string;
    db_database: string;
}

interface InstanceDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instance: FieldmaInstanceItem | null;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getCsrfToken(): string {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return meta?.content ?? '';
}

export function InstanceDrawer({ open, onOpenChange, instance }: InstanceDrawerProps) {
    const isEditing = instance !== null;
    const [slugEditedManually, setSlugEditedManually] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

    const { data, setData, post, put, processing, errors, clearErrors, reset } =
        useForm<InstanceFormData>({
            name: '',
            slug: '',
            app_url: '',
            db_database: '',
        });

    useEffect(() => {
        if (!open) {
            return;
        }

        clearErrors();
        setTestResult(null);

        if (instance) {
            setSlugEditedManually(true);
            setData({
                name: instance.name,
                slug: instance.slug,
                app_url: instance.app_url,
                db_database: instance.db_database,
            });
        } else {
            setSlugEditedManually(false);
            reset();
        }
    }, [open, instance]);

    function handleNameChange(value: string): void {
        setData('name', value);
        if (!isEditing && !slugEditedManually) {
            setData('slug', slugify(value));
        }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
            },
        };

        if (isEditing && instance) {
            put(`/instances/${instance.id}`, options);
        } else {
            post('/instances', options);
        }
    }

    async function handleTestConnection(): Promise<void> {
        setTesting(true);
        setTestResult(null);

        const endpoint =
            isEditing && instance
                ? `/instances/${instance.id}/test-connection`
                : '/instances/test-connection';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({
                    db_database: data.db_database,
                }),
            });

            if (response.status === 422) {
                const payload = (await response.json()) as { message?: string };
                setTestResult({
                    ok: false,
                    latency_ms: null,
                    mysql_version: null,
                    tables_found: 0,
                    missing_tables: [],
                    error_code: 'VALIDATION_ERROR',
                    error_message: payload.message ?? 'Enter a Database Name before testing.',
                });
                return;
            }

            if (!response.ok) {
                setTestResult({
                    ok: false,
                    latency_ms: null,
                    mysql_version: null,
                    tables_found: 0,
                    missing_tables: [],
                    error_code: `HTTP_${response.status}`,
                    error_message: 'Connection test request failed.',
                });
                return;
            }

            const result = (await response.json()) as TestConnectionResult;
            setTestResult(result);
        } catch {
            setTestResult({
                ok: false,
                latency_ms: null,
                mysql_version: null,
                tables_found: 0,
                missing_tables: [],
                error_code: 'NETWORK_ERROR',
                error_message: 'Unable to reach Central Monitor backend.',
            });
        } finally {
            setTesting(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>{isEditing ? 'Edit FieldMA Instance' : 'Add FieldMA Instance'}</SheetTitle>
                    <SheetDescription>
                        {isEditing
                            ? 'Update instance identity, URL, or target database. Host and credentials inherit from .env.'
                            : 'Register a FieldMA deployment. DB host, port, username, and password are loaded from .env.'}
                    </SheetDescription>
                </SheetHeader>

                <form id="instance-drawer-form" onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <section className="space-y-3.5">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Instance Details
                            </h3>

                            <div className="space-y-1.5">
                                <Label htmlFor="inst-name">Instance Name</Label>
                                <Input
                                    id="inst-name"
                                    value={data.name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="Acme Pharma Nepal"
                                    required
                                />
                                {errors.name && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.name}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="inst-slug">Slug</Label>
                                <Input
                                    id="inst-slug"
                                    className="font-mono text-xs"
                                    value={data.slug}
                                    onChange={(e) => {
                                        setSlugEditedManually(true);
                                        setData('slug', e.target.value);
                                    }}
                                    placeholder="acme-pharma-nepal"
                                    required
                                />
                                {errors.slug && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.slug}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="inst-app-url">Application URL</Label>
                                <Input
                                    id="inst-app-url"
                                    type="url"
                                    className="font-mono text-xs"
                                    value={data.app_url}
                                    onChange={(e) => setData('app_url', e.target.value)}
                                    placeholder="https://demo.fieldma.com"
                                    required
                                />
                                {errors.app_url && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.app_url}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="inst-db-database">Database Name</Label>
                                <Input
                                    id="inst-db-database"
                                    className="font-mono text-xs"
                                    value={data.db_database}
                                    onChange={(e) => setData('db_database', e.target.value)}
                                    placeholder="demo_fieldma"
                                    required
                                />
                                {errors.db_database && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.db_database}</p>
                                )}
                            </div>
                        </section>

                        {/*
                        Scheduled Polling, Host / IP, Port, Username, Password, and Operational Notes
                        are intentionally commented out here and resolved automatically from .env
                        (FIELDMA_DEFAULT_*) on the backend.
                        */}
                    </div>

                    {testResult && (
                        <div
                            className={cn(
                                'mx-5 mb-3 rounded-md border px-3 py-2 text-xs',
                                testResult.ok
                                    ? 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200'
                                    : 'border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200',
                            )}
                        >
                            {testResult.ok ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                        <span>
                                            Connected in {testResult.latency_ms ?? 0} ms
                                            {testResult.mysql_version ? ` · MySQL ${testResult.mysql_version}` : ''}
                                            {` · ${testResult.tables_found} tables`}
                                        </span>
                                    </div>
                                    {testResult.missing_tables.length > 0 && (
                                        <p className="pl-4 text-[11px] text-amber-700 dark:text-amber-400">
                                            Missing expected tables ({testResult.missing_tables.length}):{' '}
                                            <span className="font-mono">{testResult.missing_tables.join(', ')}</span>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 text-[11px]">
                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                                    <div>
                                        <span className="font-mono font-semibold">{testResult.error_code}</span>
                                        {testResult.latency_ms !== null && (
                                            <span className="ml-1.5 font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                                                ({testResult.latency_ms} ms)
                                            </span>
                                        )}
                                        <p className="mt-0.5 text-rose-700 dark:text-rose-300">
                                            {testResult.error_message}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <SheetFooter className="justify-between">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleTestConnection}
                            disabled={testing || processing}
                        >
                            {testing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <PlugZap className="h-3.5 w-3.5" />
                            )}
                            {testing ? 'Testing...' : 'Test Connection'}
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={processing}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Instance'}
                            </Button>
                        </div>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
