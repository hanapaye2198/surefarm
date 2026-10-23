import { Head, Link, usePage } from '@inertiajs/react';
import { AdminRegistryCharts } from '@/components/admin-registry-charts-section';
import { AdminRegistryFilters } from '@/components/admin-registry-filters';
import { AdminRegistryMap } from '@/components/admin-registry-map';
import { AdminRegistryTable } from '@/components/admin-registry-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/routes';
import type { RegistryPayload } from '@/types/admin-dashboard';

const sections = [
    ['overview', 'Overview'],
    ['distribution', 'Distribution'],
    ['ownership', 'Ownership'],
    ['map', 'Map'],
    ['registry', 'Registry'],
    ['administration', 'Administration'],
] as const;

export default function AdminDashboard({ registry }: { registry: RegistryPayload }) {
    const errors = (usePage().props.errors ?? {}) as Record<string, string | undefined>;
    const errorList = Object.values(errors).flatMap((error) =>
        typeof error === 'string' ? [error] : [],
    );

    return (
        <>
            <Head title="Registry intelligence" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Registry intelligence"
                    description={`${registry.scope}. Figures use ${registry.timezone} and the filters below. Declared and verified hectares are separate measurements.`}
                />
                <nav aria-label="Dashboard sections" className="flex gap-2 overflow-x-auto">
                    {sections.map(([id, label]) => (
                        <a key={id} href={`#${id}`} className="rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap">
                            {label}
                        </a>
                    ))}
                </nav>
                {errorList.length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {errorList.join(' ')}
                    </div>
                )}
                <AdminRegistryFilters registry={registry} />
                {registry.active_filters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {registry.active_filters.map((filter) => (
                            <Link key={filter.label} href={filter.href} preserveScroll className="rounded-full border bg-card px-3 py-1 text-xs">
                                {filter.label} ×
                            </Link>
                        ))}
                    </div>
                )}
                <section id="overview" className="grid scroll-mt-24 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                    {registry.metrics.map((metric) => (
                        <StatCard
                            key={metric.key}
                            label={metric.label}
                            value={metric.display}
                            detail={metric.detail}
                            href={metric.href ?? undefined}
                        />
                    ))}
                </section>
                <section className="grid gap-3">
                    <h2 className="text-lg font-semibold">Needs attention</h2>
                    {registry.insights.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No review items in this filtered set.</p>
                    ) : (
                        <ul className="grid gap-3 lg:grid-cols-2">
                            {registry.insights.map((insight) => (
                                <li key={insight.title}>
                                    <Link href={insight.href} preserveScroll className="block rounded-xl border bg-card px-4 py-3">
                                        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            {insight.tone === 'action' ? 'Action' : insight.tone === 'review' ? 'Review' : 'Notice'}
                                        </span>
                                        <span className="mt-1 flex items-baseline justify-between gap-3">
                                            <span className="font-medium">{insight.title}</span>
                                            <span className="text-lg font-semibold tabular-nums">{insight.count}</span>
                                        </span>
                                        <span className="mt-1 block text-sm text-muted-foreground">{insight.detail}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <AdminRegistryCharts registry={registry} />
                <section id="map" className="scroll-mt-24">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Farm map</CardTitle>
                            <CardDescription>
                                Points use saved coordinates. Polygons use saved boundaries. Missing geometry is not invented.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AdminRegistryMap registry={registry} />
                        </CardContent>
                    </Card>
                </section>
                <section id="registry" className="scroll-mt-24">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Farm registry</CardTitle>
                            <CardDescription>
                                Registered farmer is the person on the farm record. Tenure is the recorded property field, not a title search.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AdminRegistryTable registry={registry} />
                        </CardContent>
                    </Card>
                </section>
                <section id="administration" className="scroll-mt-24 grid gap-4 lg:grid-cols-2">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Accounts</CardTitle>
                            <CardDescription>Active accounts by role. Invitation tokens and passwords are not shown.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm">
                            <ul className="grid gap-2">
                                {registry.administration.users.map((role) => (
                                    <li key={role.role} className="flex justify-between gap-3">
                                        <span>{role.label}</span>
                                        <span className="font-medium tabular-nums">{role.count}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-muted-foreground">
                                {registry.administration.suspended_users} suspended. {registry.administration.open_invitations} open invitations. {registry.administration.open_grants} open registry grants.
                            </p>
                            <Link href={registry.administration.users_href} className="font-medium text-primary hover:underline">
                                Manage accounts
                            </Link>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Cooperatives and recent access</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm">
                            <ul className="grid gap-2">
                                {registry.administration.cooperatives.map((status) => (
                                    <li key={status.status} className="flex justify-between gap-3">
                                        <span>{status.label}</span>
                                        <span className="font-medium tabular-nums">{status.count}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link href={registry.administration.cooperatives_href} className="font-medium text-primary hover:underline">
                                Open cooperatives
                            </Link>
                            {registry.administration.events.length === 0 ? (
                                <p className="text-muted-foreground">No access events yet.</p>
                            ) : (
                                <ul className="grid gap-2">
                                    {registry.administration.events.map((event, index) => (
                                        <li key={`${event.action}-${index}`} className="text-muted-foreground">
                                            <span className="text-foreground">{event.action}</span>
                                            {' · '}
                                            {event.actor}
                                            {' · '}
                                            {event.at}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </section>
                <details className="rounded-xl border bg-card px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium">How these figures are calculated</summary>
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

AdminDashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
