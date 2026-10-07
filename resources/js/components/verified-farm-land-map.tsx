import { Link, usePage } from '@inertiajs/react';
import { MapPinned } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet';
import { EmptyState } from '@/components/empty-state';
import { GoogleBasemap } from '@/components/google-basemap';
import { Button } from '@/components/ui/button';
import { userCanAccess } from '@/lib/access';
import type { GoogleMapType } from '@/lib/google-maps';
import { show } from '@/routes/farms';
import 'leaflet/dist/leaflet.css';

export type VerifiedFarmLand = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_label: string;
    verified_area_hectares: number | null;
    boundary: {
        type: string;
        coordinates: [number, number][][];
    };
};

const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function ringPositions(land: VerifiedFarmLand): [number, number][] {
    const ring = land.boundary.coordinates[0] ?? [];

    return ring.map(([longitude, latitude]) => [latitude, longitude]);
}

function FitLands({
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
            map.setView(positions[0], 16);

            return;
        }

        map.fitBounds(positions, { padding: [32, 32] });
    }, [focusKey, map, positions]);

    return null;
}

export function VerifiedFarmLandMap({ lands }: { lands: VerifiedFarmLand[] }) {
    const { auth } = usePage().props;
    const canOpenFarm = userCanAccess(auth.user?.role, [
        'operations',
        'field_verifier',
    ]);
    const [selectedId, setSelectedId] = useState<number | 'all'>('all');
    const [mapType, setMapType] = useState<GoogleMapType>('hybrid');
    const [googleReady, setGoogleReady] = useState(false);
    const [googleFailed, setGoogleFailed] = useState(false);
    const googleHost = useRef<HTMLDivElement>(null);
    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
    const markGoogleReady = useCallback(() => setGoogleReady(true), []);
    const markGoogleFailed = useCallback(() => setGoogleFailed(true), []);
    const selected = lands.find((land) => land.id === selectedId) ?? null;
    const focusPositions = useMemo(() => {
        const source = selected === null ? lands : [selected];

        return source.flatMap((land) => ringPositions(land));
    }, [lands, selected]);
    const focusKey =
        selected === null
            ? `all-${lands.map((land) => land.id).join('-')}`
            : `farm-${selected.id}`;

    if (lands.length === 0) {
        return (
            <EmptyState
                icon={<MapPinned className="size-5" />}
                title="No verified farm land yet."
                description="Saved boundaries of verified farms will appear on this map."
            />
        );
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="overflow-hidden rounded-xl border">
                {googleApiKey !== '' && googleReady && (
                    <div className="flex justify-end border-b bg-background p-2">
                        <div className="inline-flex overflow-hidden rounded-md border">
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
                    </div>
                )}
                <div className="relative h-80 sm:h-[28rem]">
                    <div
                        ref={googleHost}
                        className="pointer-events-none absolute inset-0 z-0"
                        aria-hidden={googleReady ? undefined : true}
                    />
                    <MapContainer
                        center={[8.05, 125.1]}
                        zoom={11}
                        className="relative z-[1] h-full w-full"
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
                        <FitLands
                            focusKey={focusKey}
                            positions={focusPositions}
                        />
                        {lands.map((land) => {
                            const active = selected?.id === land.id;

                            return (
                                <Polygon
                                    key={land.id}
                                    positions={ringPositions(land)}
                                    eventHandlers={{
                                        click: () => setSelectedId(land.id),
                                    }}
                                    pathOptions={{
                                        color: active ? '#1f4d32' : '#2f6b45',
                                        weight: active ? 3 : 2,
                                        fillColor: '#2f6b45',
                                        fillOpacity: active ? 0.45 : 0.28,
                                    }}
                                />
                            );
                        })}
                    </MapContainer>
                </div>
            </div>
            <div className="flex min-h-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                        {lands.length} verified{' '}
                        {lands.length === 1 ? 'farm' : 'farms'}
                    </p>
                    {selected !== null && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedId('all')}
                        >
                            Show all
                        </Button>
                    )}
                </div>
                <ul className="app-scroll flex max-h-80 flex-col gap-2 overflow-y-auto sm:max-h-[24rem]">
                    {lands.map((land) => {
                        const active = selected?.id === land.id;

                        return (
                            <li key={land.id}>
                                <button
                                    type="button"
                                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
                                    onClick={() => setSelectedId(land.id)}
                                >
                                    <span className="block text-sm font-medium">
                                        {land.farm_name}
                                    </span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        {land.farm_id} · {land.farmer_name}
                                    </span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        {land.crop_label}
                                        {land.verified_area_hectares !==
                                            null &&
                                            ` · ${areaFormatter.format(land.verified_area_hectares)} ha verified`}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {selected !== null && canOpenFarm && (
                    <Button asChild variant="outline">
                        <Link href={show(selected.id)}>Open farm</Link>
                    </Button>
                )}
            </div>
        </div>
    );
}
