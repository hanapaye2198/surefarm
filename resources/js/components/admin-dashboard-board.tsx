import { Link } from '@inertiajs/react';
import { AdminRegistryMap } from '@/components/admin-registry-map';
import { TrendChart } from '@/components/admin-registry-charts';
import { farmStatusColor } from '@/lib/farm-status-colors';
import type { CropRow, RegistryMetric, RegistryPayload } from '@/types/admin-dashboard';

const cropPalette = ['#2f6b45', '#d4a017', '#2563eb', '#ea580c', '#7c3aed', '#0f766e', '#be123c', '#78716c'];

const hectares = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

export function AdminDashboardBoard({ registry }: { registry: RegistryPayload }) {
    const farms = metric(registry, 'farms');
    const declared = metric(registry, 'declared');
    const pending = metric(registry, 'pending');
    const review = metric(registry, 'review');
    const verified = registry.charts.statuses.find((row) => row.status === 'verified');

    return (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.85fr)]">
            <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <SummaryTile
                        label="Farms"
                        value={farms?.display ?? '0'}
                        detail={declared?.display ?? '0.00 ha'}
                        href={farms?.href}
                        featured
                    />
                    <SummaryTile
                        label="Verified farms"
                        value={String(verified?.farms ?? 0)}
                        detail="Current verification status"
                        href={verified?.href}
                    />
                    <SummaryTile
                        label="Pending"
                        value={pending?.display ?? '0'}
                        detail="Awaiting verification"
                        href={pending?.href}
                    />
                    <SummaryTile
                        label="Needs review"
                        value={review?.display ?? '0'}
                        detail="Latest decision asked for review"
                        href={review?.href}
                    />
                </div>
                <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="p-3 sm:p-4">
                        <AdminRegistryMap registry={registry} />
                    </div>
                </div>
            </div>
            <div className="grid gap-4">
                <article className="rounded-2xl border bg-card p-4 shadow-sm">
                    <h2 className="text-sm font-semibold">Crop distribution</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Declared hectares in the current filters.</p>
                    <CropDonut rows={registry.charts.crops} />
                </article>
                <article className="rounded-2xl border bg-card p-4 shadow-sm">
                    <h2 className="text-sm font-semibold">Recent farm registrations</h2>
                    {registry.operations.registrations.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">No farms have been registered.</p>
                    ) : (
                        <ul className="mt-3 grid gap-2">
                            {registry.operations.registrations.slice(0, 4).map((farm) => (
                                <li key={farm.id}>
                                    <Link href={farm.href} className="flex items-start gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/60">
                                        <span
                                            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold text-white"
                                            style={{ backgroundColor: farmStatusColor(farm.verification_status) }}
                                        >
                                            {farm.farm_name.slice(0, 2).toUpperCase()}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{farm.farm_name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {farm.farmer_name} · {farm.verification_label}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">{farm.registered_at ?? ''}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </article>
                <article className="rounded-2xl border bg-card p-4 shadow-sm">
                    <h2 className="text-sm font-semibold">Registration activity</h2>
                    <TrendChart
                        points={registry.charts.trend.points}
                        note={registry.charts.trend.note}
                        window={registry.charts.trend.window}
                    />
                </article>
            </div>
        </section>
    );
}

function SummaryTile({
    label,
    value,
    detail,
    href,
    featured = false,
}: {
    label: string;
    value: string;
    detail: string;
    href?: string | null;
    featured?: boolean;
}) {
    const className = featured
        ? 'rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3'
        : 'rounded-2xl border bg-card px-4 py-3 shadow-sm';
    const body = (
        <>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </>
    );

    if (href === undefined || href === null || href === '') {
        return <article className={className}>{body}</article>;
    }

    return (
        <Link href={href} className={`block ${className} focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}>
            {body}
        </Link>
    );
}

function CropDonut({ rows }: { rows: CropRow[] }) {
    const total = rows.reduce((sum, row) => sum + row.declared_hectares, 0);

    if (rows.length === 0 || total <= 0) {
        return <p className="mt-4 text-sm text-muted-foreground">No declared crop area in this filtered set.</p>;
    }

    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className="mt-4 grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <div className="relative mx-auto size-36">
                <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label="Declared hectares by crop">
                    {rows.map((row, index) => {
                        const length = (row.declared_hectares / total) * circumference;
                        const dash = `${length} ${circumference - length}`;
                        const circle = (
                            <circle
                                key={row.crop}
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="none"
                                stroke={cropPalette[index % cropPalette.length]}
                                strokeWidth="14"
                                strokeDasharray={dash}
                                strokeDashoffset={-offset}
                            />
                        );
                        offset += length;

                        return circle;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-semibold tabular-nums">{hectares.format(total)}</span>
                    <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Hectares</span>
                </div>
            </div>
            <ul className="grid gap-1.5 text-xs">
                {rows.map((row, index) => (
                    <li key={row.crop} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                            <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: cropPalette[index % cropPalette.length] }}
                            />
                            <span className="truncate">{row.label}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                            ({((row.declared_hectares / total) * 100).toFixed(1)}%) {hectares.format(row.declared_hectares)} ha
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function metric(registry: RegistryPayload, key: string): RegistryMetric | undefined {
    return registry.metrics.find((item) => item.key === key);
}
