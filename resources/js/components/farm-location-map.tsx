import { Link, usePage } from '@inertiajs/react';
import { MapPinned } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CircleMarker,
    MapContainer,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet';
import { EmptyState } from '@/components/empty-state';
import { GoogleBasemap } from '@/components/google-basemap';
import { Button } from '@/components/ui/button';
import { FarmerStatusBadge, StatusBadge } from '@/components/status-badge';
import type { FarmStatus, FarmerRecordStatus } from '@/components/status-badge';
import { userCanAccess } from '@/lib/access';
import { useGoogleMapsApiKey, type GoogleMapType } from '@/lib/google-maps';
import { show } from '@/routes/farms';
import 'leaflet/dist/leaflet.css';

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
    pending: '#737373',
    in_progress: '#0e7490',
    verified: '#166534',
    needs_review: '#b45309',
    failed: '#b91c1c',
};

const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function FitLocations({
    focusKey,
    positions,
}: {
    focusKey: string;
    positions: [number, number][];
}) {
    const map = useMap();
    const fitted = useRef('');

    useEffect(() => {
        map.invalidateSize();

        if (positions.length === 0 || fitted.current === focusKey) {
            return;
        }

        fitted.current = focusKey;

        if (positions.length === 1) {
            map.setView(positions[0], 15);

            return;
        }

        map.fitBounds(positions, { padding: [36, 36], maxZoom: 14 });
    }, [focusKey, map, positions]);

    return null;
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
    const googleApiKey = useGoogleMapsApiKey();
    const [selectedId, setSelectedId] = useState<number | null>(
        locations[0]?.id ?? null,
    );
    const [mapType, setMapType] = useState<GoogleMapType>('roadmap');
    const [googleReady, setGoogleReady] = useState(false);
    const [googleFailed, setGoogleFailed] = useState(false);
    const googleHost = useRef<HTMLDivElement>(null);
    const markGoogleReady = useCallback(() => setGoogleReady(true), []);
    const markGoogleFailed = useCallback(() => setGoogleFailed(true), []);
    const positions = useMemo(
        () =>
            locations.map(
                (location) =>
                    [location.latitude, location.longitude] as [number, number],
            ),
        [locations],
    );
    const focusKey = useMemo(
        () =>
            locations
                .map(
                    ({ id, latitude, longitude }) =>
                        `${id}:${latitude}:${longitude}`,
                )
                .join('|'),
        [locations],
    );
    const selected =
        locations.find((location) => location.id === selectedId) ??
        locations[0];

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="relative overflow-hidden rounded-xl border">
                {googleApiKey !== '' && googleReady && (
                    <div className="absolute top-3 right-3 z-[2] flex overflow-hidden rounded-md border bg-background shadow-sm">
                        <button
                            type="button"
                            className={`px-2.5 py-1 text-xs font-medium ${mapType === 'roadmap' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setMapType('roadmap')}
                        >
                            Road
                        </button>
                        <button
                            type="button"
                            className={`px-2.5 py-1 text-xs font-medium ${mapType === 'hybrid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setMapType('hybrid')}
                        >
                            Satellite
                        </button>
                    </div>
                )}
                {(googleApiKey === '' || googleFailed) && (
                    <div className="absolute top-3 left-3 z-[2] rounded-md border bg-background/95 px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
                        {googleFailed
                            ? 'Google Maps unavailable; showing OpenStreetMap'
                            : 'OpenStreetMap'}
                    </div>
                )}
                <div className="h-80 sm:h-[28rem]">
                    <div
                        ref={googleHost}
                        className="pointer-events-none absolute inset-0 z-0"
                        aria-hidden={googleReady ? undefined : true}
                    />
                    <MapContainer
                        center={positions[0]}
                        zoom={12}
                        className="relative z-[1] h-full w-full"
                        style={{ background: 'transparent' }}
                        scrollWheelZoom
                    >
                        {googleApiKey !== '' && !googleFailed && (
                            <GoogleBasemap
                                host={googleHost}
                                apiKey={googleApiKey}
                                mapType={mapType}
                                onReady={markGoogleReady}
                                onError={markGoogleFailed}
                            />
                        )}
                        {(googleApiKey === '' ||
                            googleFailed ||
                            !googleReady) && (
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                        )}
                        <FitLocations
                            focusKey={focusKey}
                            positions={positions}
                        />
                        {locations.map((location) => {
                            const active = location.id === selected.id;

                            return (
                                <CircleMarker
                                    key={location.id}
                                    center={[
                                        location.latitude,
                                        location.longitude,
                                    ]}
                                    radius={active ? 10 : 7}
                                    eventHandlers={{
                                        click: () => setSelectedId(location.id),
                                    }}
                                    pathOptions={{
                                        color: '#ffffff',
                                        weight: active ? 3 : 2,
                                        fillColor:
                                            markerColors[
                                                location.verification_status
                                            ],
                                        fillOpacity: 1,
                                    }}
                                >
                                    <Tooltip direction="top" offset={[0, -8]}>
                                        <span className="font-medium">
                                            {location.farm_id}
                                        </span>
                                        <br />
                                        {location.farm_name}
                                    </Tooltip>
                                </CircleMarker>
                            );
                        })}
                    </MapContainer>
                </div>
                <p className="absolute right-3 bottom-3 left-3 z-[2] max-w-md rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                    Markers use recorded farm coordinates. Location does not
                    indicate verification.
                </p>
            </div>

            <div className="flex min-h-80 flex-col gap-4 rounded-xl border bg-card p-4">
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
                        <dt className="text-xs text-muted-foreground">
                            Farmer
                        </dt>
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
                            {areaFormatter.format(
                                selected.declared_area_hectares,
                            )}{' '}
                            ha
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">
                            Coordinates
                        </dt>
                        <dd className="font-mono text-xs">
                            {selected.latitude}, {selected.longitude}
                        </dd>
                    </div>
                </dl>
                {canOpenFarm && (
                    <Button variant="outline" asChild>
                        <Link href={show(selected.id)}>Open farm</Link>
                    </Button>
                )}

                <div className="mt-auto border-t pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {locations.length} mapped{' '}
                        {locations.length === 1 ? 'farm' : 'farms'}
                    </p>
                    <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                        {locations.map((location) => (
                            <li key={location.id}>
                                <button
                                    type="button"
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${location.id === selected.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                                    onClick={() => setSelectedId(location.id)}
                                >
                                    <span
                                        className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
                                        style={{
                                            backgroundColor:
                                                markerColors[
                                                    location.verification_status
                                                ],
                                        }}
                                    />
                                    <span className="min-w-0 truncate">
                                        {location.farm_name}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-3">
                    <StatusBadge status="pending" />
                    <StatusBadge status="verified" />
                    <StatusBadge status="needs_review" />
                    <StatusBadge status="failed" />
                </div>
            </div>
        </div>
    );
}
