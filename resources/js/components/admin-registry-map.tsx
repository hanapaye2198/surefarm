import { Link } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { visitRegistry } from '@/components/admin-registry-filters';
import {
    loadGoogleMaps,
    type GoogleLatLng,
    type GoogleMapInstance,
    type GoogleMapType,
    type GoogleOverlay,
} from '@/lib/google-maps';
import type { MapFeature, RegistryPayload } from '@/types/admin-dashboard';

const statusColor: Record<string, string> = {
    pending: '#8a7348',
    in_progress: '#3d6b8a',
    verified: '#2f6b45',
    failed: '#8a3d3d',
    needs_review: '#8a6230',
};

function positions(feature: MapFeature): [number, number][] {
    const ring = feature.boundary?.coordinates[0] ?? [];

    return ring.map(([longitude, latitude]) => [latitude, longitude]);
}

function toLatLng([latitude, longitude]: [number, number]): GoogleLatLng {
    return { lat: latitude, lng: longitude };
}

export function AdminRegistryMap({ registry }: { registry: RegistryPayload }) {
    const { map, options, filters } = registry;
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [mapType, setMapType] = useState<GoogleMapType>('hybrid');
    const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
    const mapHost = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<GoogleMapInstance | null>(null);
    const overlays = useRef<GoogleOverlay[]>([]);
    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
    const selected = map.features.find((feature) => feature.id === selectedId) ?? null;
    const drawable = map.features.filter((feature) => {
        const hasRing = (feature.boundary?.coordinates[0]?.length ?? 0) > 2;
        const hasPoint = feature.latitude !== null && feature.longitude !== null;
        const pointsOnly = map.layer === 'locations' || map.layer === 'missing';

        return pointsOnly ? hasPoint : hasRing || hasPoint;
    });
    const focus = useMemo(() => {
        const source = selected === null ? drawable : [selected];

        return source.flatMap((feature) => {
            const ring = positions(feature);

            if (ring.length > 0 && map.layer !== 'locations' && map.layer !== 'missing') {
                return ring;
            }

            if (feature.latitude !== null && feature.longitude !== null) {
                return [[feature.latitude, feature.longitude] as [number, number]];
            }

            return [];
        });
    }, [drawable, map.layer, selected]);

    useEffect(() => {
        const element = mapHost.current;

        if (element === null) {
            return;
        }

        if (googleApiKey === '') {
            setMapStatus('missing');

            return;
        }

        let cancelled = false;
        let observer: ResizeObserver | null = null;

        loadGoogleMaps(googleApiKey)
            .then(() => {
                if (cancelled || mapInstance.current !== null || !window.google?.maps) {
                    return;
                }

                const instance = new window.google.maps.Map(element, {
                    center: { lat: 8.05, lng: 125.1 },
                    zoom: 8,
                    mapTypeId: 'hybrid',
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    clickableIcons: false,
                    gestureHandling: 'greedy',
                });
                mapInstance.current = instance;
                setMapStatus('ready');
                observer = new ResizeObserver(() => {
                    window.google?.maps.event.trigger(instance, 'resize');
                });
                observer.observe(element);
            })
            .catch(() => {
                if (!cancelled) {
                    setMapStatus('failed');
                }
            });

        return () => {
            cancelled = true;
            observer?.disconnect();
        };
    }, [googleApiKey]);

    useEffect(() => {
        mapInstance.current?.setMapTypeId(mapType);
    }, [mapType]);

    useEffect(() => {
        const instance = mapInstance.current;
        const maps = window.google?.maps;

        overlays.current.forEach((overlay) => overlay.setMap(null));
        overlays.current = [];

        if (instance === null || maps === undefined || mapStatus !== 'ready') {
            return;
        }

        drawable.forEach((feature) => {
            const color = statusColor[feature.verification_status] ?? '#2f6b45';
            const ring = positions(feature);
            const active = selected?.id === feature.id;
            const showPolygon = ring.length > 2 && map.layer !== 'locations' && map.layer !== 'missing';

            if (showPolygon) {
                const path = ring.map(toLatLng);
                const polygon = new maps.Polygon({
                    map: instance,
                    paths: path,
                    strokeColor: color,
                    strokeOpacity: feature.status === 'inactive' ? 0 : 1,
                    strokeWeight: active ? 3 : 2,
                    fillColor: color,
                    fillOpacity: active ? 0.45 : 0.28,
                    clickable: true,
                });
                polygon.addListener('click', () => setSelectedId(feature.id));
                overlays.current.push(polygon);

                if (feature.status === 'inactive') {
                    overlays.current.push(new maps.Polyline({
                        map: instance,
                        path,
                        strokeOpacity: 0,
                        icons: [{
                            icon: {
                                path: 'M 0,-1 0,1',
                                strokeOpacity: 1,
                                strokeColor: color,
                                scale: active ? 3 : 2,
                            },
                            offset: '0',
                            repeat: '10px',
                        }],
                        clickable: false,
                    }));
                }

                return;
            }

            if (feature.latitude === null || feature.longitude === null) {
                return;
            }

            const marker = new maps.Marker({
                map: instance,
                position: { lat: feature.latitude, lng: feature.longitude },
                clickable: true,
                icon: {
                    path: maps.SymbolPath.CIRCLE,
                    scale: active ? 9 : 7,
                    fillColor: color,
                    fillOpacity: 0.9,
                    strokeColor: color,
                    strokeWeight: 2,
                },
            });
            marker.addListener('click', () => setSelectedId(feature.id));
            overlays.current.push(marker);
        });

        if (focus.length === 1) {
            instance.setCenter(toLatLng(focus[0]));
            instance.setZoom(15);

            return;
        }

        if (focus.length > 1) {
            const bounds = new maps.LatLngBounds();
            focus.forEach((point) => bounds.extend(toLatLng(point)));
            instance.fitBounds(bounds, 28);
        }
    }, [drawable, focus, map.layer, mapStatus, selected]);

    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Map layer">
                {options.layers.map((layer) => (
                    <button
                        key={layer.value}
                        type="button"
                        aria-pressed={map.layer === layer.value}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${map.layer === layer.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}
                        onClick={() => visitRegistry(filters, { layer: layer.value })}
                    >
                        {layer.label}
                    </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {Object.entries(statusColor).map(([status, color]) => (
                    <span key={status} className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                        {status.replace('_', ' ')}
                    </span>
                ))}
                <span>Point = coordinates only. Polygon = saved boundary.</span>
            </div>
            <p className="text-xs text-muted-foreground">
                {map.drawn} of {map.matched} farms in this layer are loaded.
                {map.truncated ? ' Narrow the filters to see more than the first 400.' : ''}
                {map.undrawn > 0 ? ` ${map.undrawn} filtered farms are outside this layer and remain in the table.` : ''}
            </p>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="relative h-80 overflow-hidden rounded-xl border sm:h-[28rem]">
                    <div ref={mapHost} className="h-full w-full" />
                    {mapStatus === 'missing' && (
                        <p className="absolute inset-0 flex items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
                            Add a Google Maps API key to show this map.
                        </p>
                    )}
                    {mapStatus === 'failed' && (
                        <p className="absolute inset-0 flex items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
                            Google Maps could not be loaded.
                        </p>
                    )}
                    {mapStatus === 'ready' && (
                        <div className="absolute top-2 right-2 z-[1] inline-flex overflow-hidden rounded-md border bg-background">
                            <button type="button" className={`px-2 py-1 text-xs ${mapType === 'roadmap' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setMapType('roadmap')}>
                                Road
                            </button>
                            <button type="button" className={`px-2 py-1 text-xs ${mapType === 'hybrid' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setMapType('hybrid')}>
                                Satellite
                            </button>
                        </div>
                    )}
                </div>
                <FarmPanel feature={selected} features={map.features} onSelect={setSelectedId} />
            </div>
        </div>
    );
}

function FarmPanel({
    feature,
    features,
    onSelect,
}: {
    feature: MapFeature | null;
    features: MapFeature[];
    onSelect: (id: number | null) => void;
}) {
    if (feature === null) {
        return (
            <div className="grid content-start gap-2">
                <p className="text-sm font-medium">Farms in this layer</p>
                <ul className="app-scroll grid max-h-80 gap-2 overflow-y-auto sm:max-h-[24rem]">
                    {features.length === 0 && (
                        <li className="text-sm text-muted-foreground">Nothing in this layer matches the filters.</li>
                    )}
                    {features.map((item) => (
                        <li key={item.id}>
                            <button type="button" className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/60" onClick={() => onSelect(item.id)}>
                                <span className="block font-medium">{item.farm_name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {item.farm_id} · {item.verification_label} · {item.boundary_status === 'mapped' ? 'Boundary saved' : 'No boundary'}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    const place = [feature.barangay, feature.municipality, feature.province].filter(Boolean).join(', ');

    return (
        <div className="grid content-start gap-3 rounded-xl border p-3">
            <div>
                <p className="text-sm font-medium">{feature.farm_name}</p>
                <p className="text-xs text-muted-foreground">{feature.farm_id}</p>
            </div>
            <dl className="grid gap-2 text-sm">
                <Detail label="Registered farmer" value={`${feature.farmer_name} (${feature.farmer_reference})`} />
                <Detail label="Location" value={place || 'Not recorded'} />
                <Detail label="Declared area" value={`${feature.declared_area_hectares.toFixed(2)} ha`} />
                <Detail label="Verified area" value={feature.verified_area_hectares === null ? 'Not recorded' : `${feature.verified_area_hectares.toFixed(2)} ha`} />
                <Detail label="Verification" value={feature.verification_label} />
                <Detail label="Farm status" value={feature.status_label} />
                <Detail label="Boundary" value={feature.boundary_status === 'mapped' ? 'Saved polygon' : 'No saved polygon'} />
                <Detail label="Recorded tenure" value={feature.tenure ?? 'Not recorded'} />
                <Detail label="Updated" value={feature.updated_at ?? 'Not recorded'} />
            </dl>
            <div className="flex flex-wrap gap-2">
                <Link href={feature.farm_href} className="text-sm font-medium text-primary hover:underline">Open farm</Link>
                <Link href={feature.farmer_href} className="text-sm font-medium text-primary hover:underline">Open farmer</Link>
                <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => onSelect(null)}>
                    Back to list
                </button>
            </div>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}
