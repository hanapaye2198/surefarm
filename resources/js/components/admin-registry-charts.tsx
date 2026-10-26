import { Link } from '@inertiajs/react';
import type {
    CropRow,
    GeographyRow,
    OwnerRow,
    StatusRow,
    TrendPoint,
} from '@/types/admin-dashboard';
import { farmStatusColor } from '@/lib/farm-status-colors';

const area = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function ComparisonChart({
    rows,
}: {
    rows: { label: string; hectares: number }[];
}) {
    const max = Math.max(1, ...rows.map((row) => row.hectares));

    return (
        <div className="grid gap-3">
            {rows.map((row) => (
                <div key={row.label} className="grid gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>{row.label}</span>
                        <span className="font-medium tabular-nums">
                            {area.format(row.hectares)} ha
                        </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                        <div
                            className={
                                row.label === 'Verified'
                                    ? 'h-full rounded-full bg-primary'
                                    : 'h-full rounded-full bg-primary/45'
                            }
                            style={{ width: `${(row.hectares / max) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
            <p className="text-xs text-muted-foreground">
                These bars are separate measurements of the same filtered farms.
            </p>
        </div>
    );
}

export function GeographyChart({
    level,
    rows,
}: {
    level: string;
    rows: GeographyRow[];
}) {
    if (rows.length === 0) {
        return <EmptyChart label="No farms match these filters." />;
    }

    const max = Math.max(
        1,
        ...rows.flatMap((row) => [
            row.declared_hectares,
            row.verified_hectares,
        ]),
    );

    return (
        <div className="grid gap-4">
            <p className="text-xs text-muted-foreground">
                Showing{' '}
                {level === 'province'
                    ? 'provinces'
                    : level === 'municipality'
                      ? 'municipalities'
                      : 'barangays'}
                . Select a row to narrow the registry.
            </p>
            {rows.map((row) => (
                <Link
                    key={row.label}
                    href={row.href}
                    preserveScroll
                    className="grid gap-1 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">{row.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                            {row.farms} {row.farms === 1 ? 'farm' : 'farms'}
                        </span>
                    </span>
                    <Bar
                        label="Declared"
                        value={row.declared_hectares}
                        max={max}
                        muted
                    />
                    <Bar
                        label="Verified"
                        value={row.verified_hectares}
                        max={max}
                    />
                </Link>
            ))}
        </div>
    );
}

export function OwnerChart({ rows, rank }: { rows: OwnerRow[]; rank: string }) {
    if (rows.length === 0) {
        return (
            <EmptyChart label="No registered farmers match these filters." />
        );
    }

    const max = Math.max(
        1,
        ...rows.map((row) =>
            rank === 'verified' ? row.verified_hectares : row.declared_hectares,
        ),
    );

    return (
        <ol className="grid gap-4">
            {rows.map((row, index) => {
                const value =
                    rank === 'verified'
                        ? row.verified_hectares
                        : row.declared_hectares;

                return (
                    <li key={row.farmer_id} className="grid gap-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    {index + 1}.{' '}
                                    {row.profile_href ? (
                                        <Link
                                            href={row.profile_href}
                                            className="hover:underline"
                                        >
                                            {row.farmer_name}
                                        </Link>
                                    ) : (
                                        row.farmer_name
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {row.farmer_reference} · {row.farms}{' '}
                                    {row.farms === 1 ? 'farm' : 'farms'} ·{' '}
                                    {row.verified_farms} verified ·{' '}
                                    {row.pending_farms} pending
                                </p>
                            </div>
                            <Link
                                href={row.filter_href}
                                preserveScroll
                                className="shrink-0 text-xs font-medium text-primary hover:underline"
                            >
                                Show farms
                            </Link>
                        </div>
                        <Bar
                            label={
                                rank === 'verified' ? 'Verified' : 'Declared'
                            }
                            value={value}
                            max={max}
                        />
                        <p className="text-xs text-muted-foreground tabular-nums">
                            {area.format(row.declared_hectares)} ha declared ·{' '}
                            {area.format(row.verified_hectares)} ha verified
                        </p>
                    </li>
                );
            })}
        </ol>
    );
}

export function CropChart({ rows }: { rows: CropRow[] }) {
    if (rows.length === 0) {
        return <EmptyChart label="No crop area matches these filters." />;
    }

    const max = Math.max(
        1,
        ...rows.flatMap((row) => [
            row.declared_hectares,
            row.verified_hectares,
        ]),
    );

    return (
        <div className="grid gap-4">
            <p className="text-xs text-muted-foreground">
                Each farm has one crop type, so its area is counted once.
            </p>
            {rows.map((row) => (
                <div key={row.crop} className="grid gap-1">
                    <span className="text-sm font-medium">
                        {row.label}{' '}
                        <span className="font-normal text-muted-foreground">
                            · {row.farms} {row.farms === 1 ? 'farm' : 'farms'}
                        </span>
                    </span>
                    <Bar
                        label="Declared"
                        value={row.declared_hectares}
                        max={max}
                        muted
                    />
                    <Bar
                        label="Verified"
                        value={row.verified_hectares}
                        max={max}
                    />
                </div>
            ))}
        </div>
    );
}

export function StatusChart({ rows }: { rows: StatusRow[] }) {
    const max = Math.max(1, ...rows.map((row) => row.farms));

    return (
        <div className="grid gap-3">
            {rows.map((row) => (
                <Link
                    key={row.status}
                    href={row.href}
                    preserveScroll
                    className="grid gap-1 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                            <span
                                className="size-2.5 rounded-full"
                                style={{
                                    backgroundColor: farmStatusColor(
                                        row.status,
                                    ),
                                }}
                            />
                            {row.label}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                            {row.farms} · {area.format(row.declared_hectares)}{' '}
                            ha declared
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${(row.farms / max) * 100}%`,
                                backgroundColor: farmStatusColor(row.status),
                            }}
                        />
                    </div>
                </Link>
            ))}
        </div>
    );
}

export function TrendChart({
    points,
    note,
    window,
}: {
    points: TrendPoint[];
    note: string;
    window: string;
}) {
    const width = 640;
    const height = 180;
    const max = Math.max(
        1,
        ...points.flatMap((point) => [
            point.farmers,
            point.farms,
            point.verified,
        ]),
    );

    return (
        <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">
                {window}. {note}
            </p>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Registration and verification counts"
                className="h-44 w-full"
            >
                <Series
                    points={points}
                    max={max}
                    width={width}
                    height={height}
                    pick="farms"
                    color="var(--primary)"
                />
                <Series
                    points={points}
                    max={max}
                    width={width}
                    height={height}
                    pick="farmers"
                    color="color-mix(in oklch, var(--primary) 45%, transparent)"
                />
                <Series
                    points={points}
                    max={max}
                    width={width}
                    height={height}
                    pick="verified"
                    color="var(--foreground)"
                />
            </svg>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Farms</span>
                <span>Farmers</span>
                <span>Verified decisions</span>
            </div>
            {points.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    Latest period, {points[points.length - 1]?.label}:{' '}
                    {points[points.length - 1]?.farmers} farmers,{' '}
                    {points[points.length - 1]?.farms} farms,{' '}
                    {points[points.length - 1]?.verified} verified decisions.
                </p>
            )}
        </div>
    );
}

function Series({
    points,
    max,
    width,
    height,
    pick,
    color,
}: {
    points: TrendPoint[];
    max: number;
    width: number;
    height: number;
    pick: keyof Pick<TrendPoint, 'farmers' | 'farms' | 'verified'>;
    color: string;
}) {
    if (points.length === 0) {
        return null;
    }

    const step = points.length === 1 ? 0 : width / (points.length - 1);
    const path = points
        .map((point, index) => {
            const x = index * step;
            const y = height - 12 - (point[pick] / max) * (height - 24);

            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');

    return <path d={path} fill="none" stroke={color} strokeWidth="2" />;
}

function Bar({
    label,
    value,
    max,
    muted = false,
}: {
    label: string;
    value: number;
    max: number;
    muted?: boolean;
}) {
    return (
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className={
                        muted
                            ? 'h-full rounded-full bg-primary/45'
                            : 'h-full rounded-full bg-primary'
                    }
                    style={{ width: `${(value / max) * 100}%` }}
                />
            </div>
            <span className="text-right tabular-nums">
                {area.format(value)}
            </span>
        </div>
    );
}

function EmptyChart({ label }: { label: string }) {
    return <p className="text-sm text-muted-foreground">{label}</p>;
}
