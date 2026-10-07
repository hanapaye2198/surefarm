import { Link, usePage } from '@inertiajs/react';
import { MapPinned } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { FarmerStatusBadge, StatusBadge } from '@/components/status-badge';
import type { FarmStatus, FarmerRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { userCanAccess } from '@/lib/access';
import { show } from '@/routes/farms';

export type FarmLocation = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_label: string;
    declared_area_hectares: number;
    verification_status: FarmStatus;
    status: FarmerRecordStatus;
    latitude: number;
    longitude: number;
};

const markerColors: Record<FarmStatus, string> = {
    pending: 'oklch(0.52 0.02 145)',
    in_progress: 'oklch(0.55 0.1 200)',
    verified: 'oklch(0.42 0.09 152)',
    needs_review: 'oklch(0.48 0.07 55)',
    failed: 'oklch(0.55 0.18 27)',
};

const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

type Point = FarmLocation & {
    x: number;
    y: number;
};

function project(locations: FarmLocation[]): Point[] {
    const width = 800;
    const height = 460;
    const padding = 48;

    if (locations.length === 1) {
        return [
            {
                ...locations[0],
                x: width / 2,
                y: height / 2,
            },
        ];
    }

    const latitudes = locations.map((location) => location.latitude);
    const longitudes = locations.map((location) => location.longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.01);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.01);

    return locations.map((location, index) => {
        const x =
            padding +
            ((location.longitude - minLongitude) / longitudeSpan) *
                (width - padding * 2);
        const y =
            padding +
            (1 - (location.latitude - minLatitude) / latitudeSpan) *
                (height - padding * 2);

        return {
            ...location,
            x: x + (index % 3) * 0.01,
            y,
        };
    });
}

export function FarmLocationMap({
    locations,
    emptyTitle = 'No farm locations recorded yet.',
    emptyDescription = 'Add farm coordinates to begin viewing farm locations.',
}: {
    locations: FarmLocation[];
    emptyTitle?: string;
    emptyDescription?: string;
}) {
    const { auth } = usePage().props;
    const canOpenFarm = userCanAccess(auth.user?.role, [
        'operations',
        'field_verifier',
    ]);
    const points = project(locations);
    const [selectedId, setSelectedId] = useState<number | null>(
        locations[0]?.id ?? null,
    );
    const selected =
        points.find((point) => point.id === selectedId) ?? points[0];

    if (locations.length === 0 || selected === undefined) {
        return (
            <EmptyState
                icon={<MapPinned className="size-5" />}
                title={emptyTitle}
                description={emptyDescription}
            />
        );
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="relative min-h-80 overflow-hidden rounded-lg border bg-[oklch(0.97_0.015_145)]">
                <svg
                    viewBox="0 0 800 460"
                    className="h-full min-h-80 w-full"
                    role="img"
                    aria-label="Farm locations plotted from recorded coordinates"
                >
                    {[80, 160, 240, 320, 400].map((line) => (
                        <g key={line} className="text-primary/15">
                            <line
                                x1="24"
                                x2="776"
                                y1={line}
                                y2={line}
                                stroke="currentColor"
                                strokeWidth="1"
                            />
                            <line
                                y1="24"
                                y2="436"
                                x1={line + 80}
                                x2={line + 80}
                                stroke="currentColor"
                                strokeWidth="1"
                            />
                        </g>
                    ))}
                    {points.map((point) => {
                        const active = point.id === selected.id;

                        return (
                            <g key={point.id}>
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={active ? 11 : 7}
                                    fill={markerColors[point.verification_status]}
                                    stroke="white"
                                    strokeWidth={active ? 3 : 2}
                                    className="cursor-pointer"
                                    onClick={() => setSelectedId(point.id)}
                                >
                                    <title>
                                        {point.farm_id} · {point.farm_name}
                                    </title>
                                </circle>
                            </g>
                        );
                    })}
                </svg>
                <p className="absolute right-3 bottom-3 left-3 max-w-md rounded-md border bg-card/95 px-3 py-2 text-xs text-muted-foreground">
                    Markers show recorded coordinates. A location marker does
                    not mean the farm is verified.
                </p>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
                <div className="space-y-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {selected.farm_id}
                    </p>
                    <h3 className="text-base font-semibold">
                        {selected.farm_name}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <StatusBadge status={selected.verification_status} />
                        <FarmerStatusBadge status={selected.status} />
                    </div>
                </div>
                <dl className="grid gap-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground">Farmer</dt>
                        <dd>{selected.farmer_name}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Crop</dt>
                        <dd>{selected.crop_label}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">
                            Declared area
                        </dt>
                        <dd>
                            {areaFormatter.format(selected.declared_area_hectares)}{' '}
                            ha
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">
                            Coordinates
                        </dt>
                        <dd>
                            {selected.latitude}, {selected.longitude}
                        </dd>
                    </div>
                </dl>
                {canOpenFarm && (
                    <Button variant="outline" asChild>
                        <Link href={show(selected.id)}>Open farm</Link>
                    </Button>
                )}
                <div className="mt-auto flex flex-col gap-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                        Marker color is verification status
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <StatusBadge status="pending" />
                        <StatusBadge status="verified" />
                        <StatusBadge status="needs_review" />
                    </div>
                </div>
            </div>
        </div>
    );
}
