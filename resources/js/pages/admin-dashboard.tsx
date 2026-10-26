import { Head, Link, usePage } from '@inertiajs/react';
import {
    BadgeCheck,
    Clock,
    LandPlot,
    MapPinned,
    OctagonAlert,
    Ruler,
    Sprout,
    TriangleAlert,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminDashboardBoard } from '@/components/admin-dashboard-board';
import { AdminRegistryCharts } from '@/components/admin-registry-charts-section';
import { AdminRegistryFilters } from '@/components/admin-registry-filters';
import { AdminRegistryOperations } from '@/components/admin-registry-operations';
import { AdminRegistryTable } from '@/components/admin-registry-table';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { farmStatusColor } from '@/lib/farm-status-colors';
import { dashboard } from '@/routes';
import { index as activitiesIndex } from '@/routes/farm-activities';
import { index as farmVerificationIndex } from '@/routes/farm-verification';
import { create as createFarmer } from '@/routes/farmers';
import { index as harvestIndex } from '@/routes/harvest';
import { index as inventoryIndex } from '@/routes/inventory';
import type { RegistryMetric, RegistryPayload } from '@/types/admin-dashboard';

const sections = [
    ['board', 'Overview'],
    ['overview', 'Figures'],
    ['distribution', 'Distribution'],
    ['ownership', 'Ownership'],
    ['registry', 'Registry'],
    ['operations', 'Operations'],
    ['administration', 'Administration'],
] as const;

const registryMetricKeys = [
    'farmers',
    'farms',
    'declared',
    'verified',
    'unverified',
    'active',
];
const landMetricKeys = ['mapped', 'missing'];

const metricPresentation: Record<
    string,
    {
        icon: LucideIcon;
        tone: 'neutral' | 'positive' | 'warning' | 'critical';
        accent?: string;
    }
> = {
    farmers: { icon: Users, tone: 'positive' },
    farms: { icon: LandPlot, tone: 'positive' },
    declared: { icon: Ruler, tone: 'neutral', accent: '#6b4f3a' },
    verified: { icon: BadgeCheck, tone: 'positive' },
    unverified: { icon: Ruler, tone: 'warning', accent: '#8a6a45' },
    active: { icon: Sprout, tone: 'positive' },
    pending: {
        icon: Clock,
        tone: 'warning',
        accent: farmStatusColor('pending'),
    },
    review: {
        icon: TriangleAlert,
        tone: 'warning',
        accent: farmStatusColor('needs_review'),
    },
    mapped: { icon: MapPinned, tone: 'positive' },
    missing: { icon: MapPinned, tone: 'critical' },
};

const countLabels: Record<string, { label: string; icon: LucideIcon }> = {
    in_progress: { label: 'In-progress verification', icon: Clock },
    verified: { label: 'Verified farms', icon: BadgeCheck },
    failed: { label: 'Failed verification', icon: OctagonAlert },
};

function registryDate(timeZone: string): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    };

    try {
        return new Intl.DateTimeFormat('en-US', {
            ...options,
            timeZone,
        }).format(new Date());
    } catch {
        return new Intl.DateTimeFormat('en-US', options).format(new Date());
    }
}

function metricsByKey(
    metrics: RegistryMetric[],
    keys: string[],
): RegistryMetric[] {
    return keys.flatMap((key) => {
        const metric = metrics.find((item) => item.key === key);

        return metric === undefined ? [] : [metric];
    });
}

export default function AdminDashboard({
    registry,
}: {
    registry: RegistryPayload;
}) {
    const errors = (usePage().props.errors ?? {}) as Record<
        string,
        string | undefined
    >;
    const errorList = Object.values(errors).flatMap((error) =>
        typeof error === 'string' ? [error] : [],
    );

    return (
        <>
            <Head title="Admin Dashboard" />
            <div className="-m-4 flex min-h-full flex-col gap-5 bg-canvas px-4 py-5 sm:-m-6 sm:gap-6 sm:px-6 sm:py-6 lg:-m-8 lg:px-8 lg:py-8">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Admin Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {registryDate(registry.timezone)}
                            {' · '}
                            {registry.scope}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={createFarmer()}>Register farmer</Link>
                        </Button>
                        <Button size="sm" asChild>
                            <Link
                                href={farmVerificationIndex.url({
                                    query: { verification_status: 'pending' },
                                })}
                            >
                                Review pending verifications
                            </Link>
                        </Button>
                    </div>
                </header>
                <div id="board" className="scroll-mt-24">
                    <AdminDashboardBoard registry={registry} />
                </div>
                <nav
                    aria-label="Dashboard sections"
                    className="flex gap-2 overflow-x-auto"
                >
                    {sections.map(([id, label]) => (
                        <a
                            key={id}
                            href={`#${id}`}
                            className="rounded-full border bg-card px-3 py-1 text-xs font-medium whitespace-nowrap"
                        >
                            {label}
                        </a>
                    ))}
                </nav>
                {errorList.length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {errorList.join(' ')}
                    </div>
                )}
                {registry.active_filters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {registry.active_filters.map((filter) => (
                            <Link
                                key={filter.label}
                                href={filter.href}
                                preserveScroll
                                className="rounded-full border bg-card px-3 py-1 text-xs"
                            >
                                {filter.label} ×
                            </Link>
                        ))}
                    </div>
                )}
                <section id="overview" className="grid scroll-mt-24 gap-5">
                    <MetricGroup
                        title="Farmer and farm registry"
                        metrics={metricsByKey(registry.metrics, registryMetricKeys)}
                    />
                    <div className="grid gap-3">
                        <h2 className="text-lg font-semibold">Verification</h2>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
                            <MetricCards
                                metrics={metricsByKey(registry.metrics, [
                                    'pending',
                                ])}
                            />
                            {(['in_progress', 'verified'] as const).map(
                                (status) => (
                                    <StatusCount
                                        key={status}
                                        registry={registry}
                                        status={status}
                                    />
                                ),
                            )}
                            <MetricCards
                                metrics={metricsByKey(registry.metrics, [
                                    'review',
                                ])}
                            />
                            <StatusCount registry={registry} status="failed" />
                        </div>
                    </div>
                    <MetricGroup
                        title="Boundaries"
                        metrics={metricsByKey(registry.metrics, landMetricKeys)}
                    />
                </section>
                <section className="grid gap-3">
                    <h2 className="text-lg font-semibold">Needs attention</h2>
                    {registry.insights.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No review items in this filtered set.
                        </p>
                    ) : (
                        <ul className="grid gap-3 lg:grid-cols-2">
                            {registry.insights.map((insight) => (
                                <li key={insight.title}>
                                    <Link
                                        href={insight.href}
                                        preserveScroll
                                        className="block rounded-xl border bg-card px-4 py-3"
                                    >
                                        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            {insight.tone === 'action'
                                                ? 'Action'
                                                : insight.tone === 'review'
                                                  ? 'Review'
                                                  : 'Notice'}
                                        </span>
                                        <span className="mt-1 flex items-baseline justify-between gap-3">
                                            <span className="font-medium">
                                                {insight.title}
                                            </span>
                                            <span className="text-lg font-semibold tabular-nums">
                                                {insight.count}
                                            </span>
                                        </span>
                                        <span className="mt-1 block text-sm text-muted-foreground">
                                            {insight.detail}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <details
                    key={registry.active_filters.map((filter) => filter.label).join('|') || 'none'}
                    className="rounded-xl border bg-card px-4 py-3"
                    defaultOpen={registry.active_filters.length > 0}
                >
                    <summary className="cursor-pointer text-sm font-medium">Filter the registry</summary>
                    <div className="pt-3">
                        <AdminRegistryFilters registry={registry} />
                    </div>
                </details>
                <AdminRegistryCharts registry={registry} />
                <section id="registry" className="scroll-mt-24">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Farm registry</CardTitle>
                            <CardDescription>
                                Registered farmer is the person on the farm
                                record. Tenure is the recorded property field,
                                not a title search.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AdminRegistryTable registry={registry} />
                        </CardContent>
                    </Card>
                </section>
                <AdminRegistryOperations
                    registry={registry}
                    harvestHref={harvestIndex.url()}
                    inventoryHref={inventoryIndex.url()}
                    activitiesHref={activitiesIndex.url()}
                />
                <section
                    id="administration"
                    className="grid scroll-mt-24 gap-4 lg:grid-cols-2"
                >
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Accounts</CardTitle>
                            <CardDescription>
                                Active accounts by role. Invitation tokens and
                                passwords are not shown.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm">
                            <ul className="grid gap-2">
                                {registry.administration.users.map((role) => (
                                    <li
                                        key={role.role}
                                        className="flex justify-between gap-3"
                                    >
                                        <span>{role.label}</span>
                                        <span className="font-medium tabular-nums">
                                            {role.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-muted-foreground">
                                {registry.administration.suspended_users}{' '}
                                suspended.{' '}
                                {registry.administration.open_invitations} open
                                invitations.{' '}
                                {registry.administration.open_grants} open
                                registry grants.
                            </p>
                            <Link
                                href={registry.administration.users_href}
                                className="font-medium text-primary hover:underline"
                            >
                                Manage accounts
                            </Link>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>
                                Cooperatives and recent access
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm">
                            <ul className="grid gap-2">
                                {registry.administration.cooperatives.map(
                                    (status) => (
                                        <li
                                            key={status.status}
                                            className="flex justify-between gap-3"
                                        >
                                            <span>{status.label}</span>
                                            <span className="font-medium tabular-nums">
                                                {status.count}
                                            </span>
                                        </li>
                                    ),
                                )}
                            </ul>
                            <Link
                                href={registry.administration.cooperatives_href}
                                className="font-medium text-primary hover:underline"
                            >
                                Open cooperatives
                            </Link>
                            {registry.administration.events.length === 0 ? (
                                <p className="text-muted-foreground">
                                    No access events yet.
                                </p>
                            ) : (
                                <ul className="grid gap-2">
                                    {registry.administration.events.map(
                                        (event, index) => (
                                            <li
                                                key={`${event.action}-${index}`}
                                                className="text-muted-foreground"
                                            >
                                                <span className="text-foreground">
                                                    {event.action}
                                                </span>
                                                {' · '}
                                                {event.actor}
                                                {' · '}
                                                {event.at}
                                            </li>
                                        ),
                                    )}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </section>
                <details className="rounded-xl border bg-card px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                        How these figures are calculated
                    </summary>
                    <ul className="mt-3 grid list-disc gap-2 pl-5 text-muted-foreground">
                        {registry.notes.map((note) => (
                            <li key={note}>{note}</li>
                        ))}
                    </ul>
                </details>
            </div>
        </>
    );
}

function MetricGroup({ title, metrics }: { title: string; metrics: RegistryMetric[] }) {
    return (
        <div className="grid gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                <MetricCards metrics={metrics} />
            </div>
        </div>
    );
}

function MetricCards({ metrics }: { metrics: RegistryMetric[] }) {
    return (
        <>
            {metrics.map((metric) => {
                const presentation = metricPresentation[metric.key];

                return (
                    <StatCard
                        key={metric.key}
                        label={metric.label}
                        value={metric.display}
                        detail={metric.detail}
                        href={metric.href ?? undefined}
                        icon={presentation?.icon}
                        tone={presentation?.tone ?? 'neutral'}
                        accent={presentation?.accent}
                    />
                );
            })}
        </>
    );
}

function StatusCount({ registry, status }: { registry: RegistryPayload; status: string }) {
    const row = registry.charts.statuses.find((item) => item.status === status);
    const presentation = countLabels[status];

    if (row === undefined || presentation === undefined) {
        return null;
    }

    return (
        <StatCard
            label={presentation.label}
            value={String(row.farms)}
            detail="Farms in the current filters."
            href={row.href}
            icon={presentation.icon}
            accent={farmStatusColor(status)}
        />
    );
}

AdminDashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
