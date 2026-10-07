import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet';
import { GoogleBasemap } from '@/components/google-basemap';
import type { GoogleMapType } from '@/lib/google-maps';
import 'leaflet/dist/leaflet.css';

type Boundary = {
    type: string;
    coordinates: [number, number][][];
};

function positionsOf(boundary: Boundary | null, latitude: number | null, longitude: number | null): [number, number][] {
    const ring = boundary?.coordinates[0] ?? [];

    if (ring.length > 0) {
        return ring.map(([longitude, latitude]) => [latitude, longitude]);
    }

    if (latitude !== null && longitude !== null) {
        return [[latitude, longitude]];
    }

    return [];
}

function FitOrigin({ positions }: { positions: [number, number][] }) {
    const map = useMap();
    const fitted = useRef(false);

    useEffect(() => {
        map.invalidateSize();

        if (fitted.current || positions.length === 0) {
            return;
        }

        fitted.current = true;

        if (positions.length === 1) {
            map.setView(positions[0], 16);

            return;
        }

        map.fitBounds(positions, { padding: [28, 28] });
    }, [map, positions]);

    return null;
}

export function TraceabilityOriginMap({
    latitude,
    longitude,
    boundary,
}: {
    latitude: number | null;
    longitude: number | null;
    boundary: Boundary | null;
}) {
    const positions = positionsOf(boundary, latitude, longitude);
    const [mapType, setMapType] = useState<GoogleMapType>('hybrid');
    const [googleReady, setGoogleReady] = useState(false);
    const [googleFailed, setGoogleFailed] = useState(false);
    const googleHost = useRef<HTMLDivElement>(null);
    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
    const markGoogleReady = useCallback(() => setGoogleReady(true), []);
    const markGoogleFailed = useCallback(() => setGoogleFailed(true), []);

    if (positions.length === 0) {
        return <p className="text-sm text-muted-foreground">Farm location not available.</p>;
    }

    return (
        <div className="overflow-hidden rounded-xl border">
            {googleApiKey !== '' && googleReady && (
                <div className="flex justify-end border-b bg-background p-2">
                    <div className="inline-flex overflow-hidden rounded-md border">
                        <button type="button" className={`px-2.5 py-1 text-xs font-medium ${mapType === 'roadmap' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} onClick={() => setMapType('roadmap')}>Road</button>
                        <button type="button" className={`px-2.5 py-1 text-xs font-medium ${mapType === 'hybrid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} onClick={() => setMapType('hybrid')}>Satellite</button>
                    </div>
                </div>
            )}
            <div className="relative h-72">
                <div ref={googleHost} className="pointer-events-none absolute inset-0 z-0" aria-hidden={googleReady ? undefined : true} />
                <MapContainer center={positions[0]} zoom={16} className="relative z-[1] h-full w-full" scrollWheelZoom={false}>
                    {googleApiKey !== '' && !googleFailed && (
                        <GoogleBasemap host={googleHost} apiKey={googleApiKey} mapType={mapType} onReady={markGoogleReady} onError={markGoogleFailed} />
                    )}
                    {(googleApiKey === '' || googleFailed || !googleReady) && (
                        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    )}
                    <FitOrigin positions={positions} />
                    {boundary && positions.length > 2 && (
                        <Polygon positions={positions} pathOptions={{ color: '#1f4d32', weight: 2, fillColor: '#2f6b45', fillOpacity: 0.35 }} />
                    )}
                    {latitude !== null && longitude !== null && (
                        <CircleMarker center={[latitude, longitude]} radius={7} pathOptions={{ color: '#1f4d32', fillColor: '#2f6b45', fillOpacity: 1 }} />
                    )}
                </MapContainer>
            </div>
        </div>
    );
}
