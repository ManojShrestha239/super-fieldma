export type UserRole = 'admin' | 'viewer';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    is_admin: boolean;
}

export interface FlashMessages {
    success: string | null;
    error: string | null;
}

export interface SharedPageProps {
    auth: {
        user: AuthUser | null;
    };
    flash: FlashMessages;
    [key: string]: unknown;
}

export type InstanceStatus = 'online' | 'degraded' | 'offline';

export interface FieldmaInstanceItem {
    id: number;
    name: string;
    slug: string;
    app_url: string;
    db_ip: string;
    db_port: number;
    db_database: string;
    db_user: string;
    is_active: boolean;
    notes: string | null;
    last_tested_at: string | null;
    last_test_ok: boolean | null;
    last_latency_ms: number | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface FieldmaMetrics {
    users_count: number | null;
    login_users_count: number | null;
    checked_in_users_count: number | null;
    checked_out_users_count: number | null;
    orders_count: number | null;
    online_visits_count: number | null;
    offline_visits_count: number | null;
    unlisted_visits_count: number | null;
    collections_count: number | null;
    daily_reports_count: number | null;
    expense_entries_count: number | null;
    gps_tracked_users_count: number | null;
    messages_users_count: number | null;
    scheduled_visits_users_count: number | null;
    site_registrations_count: number | null;
    notices_count: number | null;
}

export interface FieldmaMetricsUpdatedPayload {
    instance_id: number;
    snapshot_date: string;
    status: InstanceStatus;
    latency_ms: number | null;
    polled_at: string;
    error_code: string | null;
    error_message: string | null;
    missing_tables: string[];
    metrics: FieldmaMetrics;
}

export interface DashboardRow {
    instance_id: number;
    name: string;
    slug: string;
    app_url: string;
    db_ip: string;
    db_port: number;
    db_database: string;
    db_user: string;
    is_active: boolean;
    notes: string | null;
    status: InstanceStatus | null;
    latency_ms: number | null;
    polled_at: string | null;
    error_code: string | null;
    error_message: string | null;
    missing_tables: string[];
    metrics: FieldmaMetrics;
}

export interface TestConnectionResult {
    ok: boolean;
    latency_ms: number | null;
    mysql_version: string | null;
    tables_found: number;
    missing_tables: string[];
    error_code: string | null;
    error_message: string | null;
}
