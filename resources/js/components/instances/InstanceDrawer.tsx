import { useForm } from "@inertiajs/react";
import { Eye, EyeOff, Loader2, PlugZap } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
    FieldmaInstanceItem,
    TestConnectionResult,
} from "@/types/fieldma";

interface InstanceFormData {
    name: string;
    slug: string;
    app_url: string;
    db_ip: string;
    db_port: number;
    db_database: string;
    db_user: string;
    db_password: string;
    is_active: boolean;
    notes: string;
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
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getCsrfToken(): string {
    const meta = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    );
    return meta?.content ?? "";
}

export function InstanceDrawer({
    open,
    onOpenChange,
    instance,
}: InstanceDrawerProps) {
    const isEditing = instance !== null;
    const [slugEditedManually, setSlugEditedManually] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestConnectionResult | null>(
        null,
    );

    const { data, setData, post, put, processing, errors, clearErrors, reset } =
        useForm<InstanceFormData>({
            name: "",
            slug: "",
            app_url: "",
            db_ip: "",
            db_port: 3306,
            db_database: "",
            db_user: "",
            db_password: "",
            is_active: true,
            notes: "",
        });

    useEffect(() => {
        if (!open) {
            return;
        }

        clearErrors();
        setTestResult(null);
        setShowPassword(false);

        if (instance) {
            setSlugEditedManually(true);
            setData({
                name: instance.name,
                slug: instance.slug,
                app_url: instance.app_url,
                db_ip: instance.db_ip,
                db_port: instance.db_port,
                db_database: instance.db_database,
                db_user: instance.db_user,
                db_password: "",
                is_active: instance.is_active,
                notes: instance.notes ?? "",
            });
        } else {
            setSlugEditedManually(false);
            reset();
        }
    }, [open, instance]);

    function handleNameChange(value: string): void {
        setData("name", value);
        if (!isEditing && !slugEditedManually) {
            setData("slug", slugify(value));
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
            post("/instances", options);
        }
    }

    async function handleTestConnection(): Promise<void> {
        setTesting(true);
        setTestResult(null);

        const endpoint =
            isEditing && instance
                ? `/instances/${instance.id}/test-connection`
                : "/instances/test-connection";

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "X-CSRF-TOKEN": getCsrfToken(),
                },
                body: JSON.stringify({
                    db_ip: data.db_ip,
                    db_port: Number(data.db_port) || 3306,
                    db_database: data.db_database,
                    db_user: data.db_user,
                    db_password:
                        data.db_password !== "" ? data.db_password : null,
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
                    error_code: "VALIDATION_ERROR",
                    error_message:
                        payload.message ??
                        "Fill in all required DB fields before testing.",
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
                    error_message: "Connection test request failed.",
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
                error_code: "NETWORK_ERROR",
                error_message: "Unable to reach Central Monitor backend.",
            });
        } finally {
            setTesting(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>
                        {isEditing
                            ? "Edit FieldMA Instance"
                            : "Add FieldMA Instance"}
                    </SheetTitle>
                    <SheetDescription>
                        {isEditing
                            ? "Update deployment metadata or rotate read-only MySQL credentials."
                            : "Register a remote FieldMA MySQL deployment for central monitoring."}
                    </SheetDescription>
                </SheetHeader>

                <form
                    id="instance-drawer-form"
                    onSubmit={handleSubmit}
                    className="flex flex-1 flex-col overflow-hidden"
                >
                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <section className="space-y-3">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                Identity
                            </h3>

                            <div className="space-y-1.5">
                                <Label htmlFor="inst-name">Instance Name</Label>
                                <Input
                                    id="inst-name"
                                    value={data.name}
                                    onChange={(e) =>
                                        handleNameChange(e.target.value)
                                    }
                                    placeholder="Acme Pharma Nepal"
                                    required
                                />
                                {errors.name && (
                                    <p className="text-[11px] text-rose-600">
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="inst-slug">Slug</Label>
                                    <Input
                                        id="inst-slug"
                                        className="font-mono text-xs"
                                        value={data.slug}
                                        onChange={(e) => {
                                            setSlugEditedManually(true);
                                            setData("slug", e.target.value);
                                        }}
                                        placeholder="acme-pharma-nepal"
                                        required
                                    />
                                    {errors.slug && (
                                        <p className="text-[11px] text-rose-600">
                                            {errors.slug}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="inst-active">
                                        Scheduled Polling
                                    </Label>
                                    <div className="flex h-8 items-center justify-between rounded-md border border-zinc-200 px-2.5">
                                        <span className="text-xs text-zinc-700">
                                            {data.is_active
                                                ? "Active"
                                                : "Paused"}
                                        </span>
                                        <Switch
                                            id="inst-active"
                                            checked={data.is_active}
                                            onCheckedChange={(checked) =>
                                                setData("is_active", checked)
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="inst-app-url">
                                    Application URL
                                </Label>
                                <Input
                                    id="inst-app-url"
                                    type="url"
                                    className="font-mono text-xs"
                                    value={data.app_url}
                                    onChange={(e) =>
                                        setData("app_url", e.target.value)
                                    }
                                    placeholder="https://acme.fieldma.local"
                                    required
                                />
                                {errors.app_url && (
                                    <p className="text-[11px] text-rose-600">
                                        {errors.app_url}
                                    </p>
                                )}
                            </div>
                        </section>

                        <section className="space-y-3 border-t border-zinc-200 pt-4">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                Remote MySQL Connection (Read-Only)
                            </h3>

                            <div className="grid grid-cols-4 gap-3">
                                <div className="col-span-3 space-y-1.5">
                                    <Label htmlFor="inst-db-ip">
                                        Host / IP
                                    </Label>
                                    <Input
                                        id="inst-db-ip"
                                        className="font-mono text-xs"
                                        value={data.db_ip}
                                        onChange={(e) =>
                                            setData("db_ip", e.target.value)
                                        }
                                        placeholder="mock-remote-db"
                                        required
                                    />
                                    {errors.db_ip && (
                                        <p className="text-[11px] text-rose-600">
                                            {errors.db_ip}
                                        </p>
                                    )}
                                </div>

                                <div className="col-span-1 space-y-1.5">
                                    <Label htmlFor="inst-db-port">Port</Label>
                                    <Input
                                        id="inst-db-port"
                                        type="number"
                                        min={1}
                                        max={65535}
                                        className="font-mono text-xs tabular-nums"
                                        value={data.db_port}
                                        onChange={(e) =>
                                            setData(
                                                "db_port",
                                                Number(e.target.value) || 3306,
                                            )
                                        }
                                        required
                                    />
                                    {errors.db_port && (
                                        <p className="text-[11px] text-rose-600">
                                            {errors.db_port}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="inst-db-database">
                                        Database Name
                                    </Label>
                                    <Input
                                        id="inst-db-database"
                                        className="font-mono text-xs"
                                        value={data.db_database}
                                        onChange={(e) =>
                                            setData(
                                                "db_database",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="fieldma_alpha"
                                        required
                                    />
                                    {errors.db_database && (
                                        <p className="text-[11px] text-rose-600">
                                            {errors.db_database}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="inst-db-user">
                                        Username
                                    </Label>
                                    <Input
                                        id="inst-db-user"
                                        className="font-mono text-xs"
                                        value={data.db_user}
                                        onChange={(e) =>
                                            setData("db_user", e.target.value)
                                        }
                                        placeholder="fieldma_ro"
                                        required
                                    />
                                    {errors.db_user && (
                                        <p className="text-[11px] text-rose-600">
                                            {errors.db_user}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="inst-db-password">
                                    Password{" "}
                                    {isEditing && (
                                        <span className="font-normal text-zinc-400">
                                            (encrypted at rest)
                                        </span>
                                    )}
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="inst-db-password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        className="pr-9 font-mono text-xs"
                                        value={data.db_password}
                                        onChange={(e) =>
                                            setData(
                                                "db_password",
                                                e.target.value,
                                            )
                                        }
                                        placeholder={
                                            isEditing
                                                ? "Leave blank to keep existing password"
                                                : "Read-only DB password"
                                        }
                                        required={!isEditing}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword((prev) => !prev)
                                        }
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-3.5 w-3.5" />
                                        ) : (
                                            <Eye className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>
                                {errors.db_password && (
                                    <p className="text-[11px] text-rose-600">
                                        {errors.db_password}
                                    </p>
                                )}
                            </div>
                        </section>

                        <section className="space-y-1.5 border-t border-zinc-200 pt-4">
                            <Label htmlFor="inst-notes">
                                Operational Notes
                            </Label>
                            <textarea
                                id="inst-notes"
                                rows={3}
                                value={data.notes}
                                onChange={(e) =>
                                    setData("notes", e.target.value)
                                }
                                placeholder="VPN tunnel requirement, legacy clone notes, client contact..."
                                className="flex w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200"
                            />
                            {errors.notes && (
                                <p className="text-[11px] text-rose-600">
                                    {errors.notes}
                                </p>
                            )}
                        </section>
                    </div>

                    {testResult && (
                        <div
                            className={cn(
                                "mx-5 mb-3 rounded-md border px-3 py-2 text-xs",
                                testResult.ok
                                    ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                                    : "border-rose-200 bg-rose-50/60 text-rose-800",
                            )}
                        >
                            {testResult.ok ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                        <span>
                                            Connected in{" "}
                                            {testResult.latency_ms ?? 0} ms
                                            {testResult.mysql_version
                                                ? ` · MySQL ${testResult.mysql_version}`
                                                : ""}
                                            {` · ${testResult.tables_found} tables`}
                                        </span>
                                    </div>
                                    {testResult.missing_tables.length > 0 && (
                                        <p className="pl-4 text-[11px] text-amber-700">
                                            Missing expected tables (
                                            {testResult.missing_tables.length}):{" "}
                                            <span className="font-mono">
                                                {testResult.missing_tables.join(
                                                    ", ",
                                                )}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 text-[11px]">
                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                                    <div>
                                        <span className="font-mono font-semibold">
                                            {testResult.error_code}
                                        </span>
                                        {testResult.latency_ms !== null && (
                                            <span className="ml-1.5 font-mono text-rose-600 tabular-nums">
                                                ({testResult.latency_ms} ms)
                                            </span>
                                        )}
                                        <p className="mt-0.5 text-rose-700">
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
                            {testing ? "Testing..." : "Test Connection"}
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
                                {processing
                                    ? "Saving..."
                                    : isEditing
                                      ? "Save Changes"
                                      : "Add Instance"}
                            </Button>
                        </div>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
