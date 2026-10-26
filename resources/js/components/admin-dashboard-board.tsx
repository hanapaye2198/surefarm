import { Link } from '@inertiajs/react';
import { AdminRegistryMap } from '@/components/admin-registry-map';
import { TrendChart } from '@/components/admin-registry-charts';
import { farmStatusColor } from '@/lib/farm-status-colors';
import type {
    CropRow,
    RegistryMetric,
    RegistryPayload,
} from '@/types/admin-dashboard';

const hectares = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

export function AdminDashboardBoard({
    registry,
}: {
    registry: RegistryPayload;
}) {
    const farms = metric(registry, 'farms');
    const declared = metric(registry, 'declared');
    const pending = metric(registry, 'pending');
    const review = metric(registry, 'review');
    const verified = registry.charts.statuses.find(
        (row) => row.status === 'verified',
    );

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
                    <h2 className="text-sm font-semibold">Coffee area</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Declared and verified coffee hectares. Other crops are
                        left out.
                    </p>
                    <CoffeeAreaChart rows={registry.charts.crops} />
                </article>
                <article className="rounded-2xl border bg-card p-4 shadow-sm">
                    <h2 className="text-sm font-semibold">
                        Recent farm registrations
                    </h2>
                    {registry.operations.registrations.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                            No farms have been registered.
                        </p>
                    ) : (
                        <ul className="mt-3 grid gap-2">
                            {registry.operations.registrations
                                .slice(0, 4)
                                .map((farm) => (
                                    <li key={farm.id}>
                                        <Link
                                            href={farm.href}
                                            className="flex items-start gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/60"
                                        >
                                            <span
                                                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold text-white"
                                                style={{
                                                    backgroundColor:
                                                        farmStatusColor(
                                                            farm.verification_status,
                                                        ),
                                                }}
                                            >
                                                {farm.farm_name
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">
                                                    {farm.farm_name}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {farm.farmer_name} ·{' '}
                                                    {farm.verification_label}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                {farm.registered_at ?? ''}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                        </ul>
                    )}
                </article>
                <article className="rounded-2xl border bg-card p-4 shadow-sm">
                    <h2 className="text-sm font-semibold">
                        Registration activity
                    </h2>
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
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </>
    );

    if (href === undefined || href === null || href === '') {
        return <article className={className}>{body}</article>;
    }

    return (
        <Link
            href={href}
            className={`block ${className} focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
        >
            {body}
        </Link>
    );
}

function CoffeeAreaChart({ rows }: { rows: CropRow[] }) {
    const coffee = rows.find((row) => row.crop === 'coffee');
    const slices = [
        {
            label: 'Declared',
            value: coffee?.declared_hectares ?? 0,
            color: '#6b4f3a',
        },
        {
            label: 'Verified',
            value: coffee?.verified_hectares ?? 0,
            color: '#2f6b45',
        },
    ];
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);

    if (coffee === undefined || coffee.farms === 0) {
        return (
            <p className="mt-4 text-sm text-muted-foreground">
                No coffee farms in this filtered set.
            </p>
        );
    }

    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className="mt-4 grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <div className="relative mx-auto size-36">
                <svg
                    viewBox="0 0 120 120"
                    className="size-full -rotate-90"
                    role="img"
                    aria-label="Declared and verified coffee hectares"
                >
                    {total <= 0 ? (
                        <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="none"
                            stroke="#e7e5e4"
                            strokeWidth="14"
                        />
                    ) : (
                        slices.map((slice) => {
                            const length =
                                (slice.value / total) * circumference;
                            const circle = (
                                <circle
                                    key={slice.label}
                                    cx="60"
                                    cy="60"
                                    r={radius}
                                    fill="none"
                                    stroke={slice.color}
                                    strokeWidth="14"
                                    strokeDasharray={`${length} ${circumference - length}`}
                                    strokeDashoffset={-offset}
                                />
                            );
                            offset += length;

                            return circle;
                        })
                    )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-semibold tabular-nums">
                        {coffee.farms}
                    </span>
                    <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                        Farms
                    </span>
                </div>
            </div>
            <ul className="grid gap-1.5 text-xs">
                {slices.map((slice) => (
                    <li
                        key={slice.label}
                        className="flex items-center justify-between gap-2"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: slice.color }}
                            />
                            <span className="truncate">{slice.label}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                            {total > 0
                                ? `(${((slice.value / total) * 100).toFixed(1)}%) `
                                : ''}
                            {hectares.format(slice.value)} ha
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function metric(
    registry: RegistryPayload,
    key: string,
): RegistryMetric | undefined {
    return registry.metrics.find((item) => item.key === key);
}
