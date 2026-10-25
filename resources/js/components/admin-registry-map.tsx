import { Link } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { visitRegistry } from '@/components/admin-registry-filters';
import {
    loadGoogleMaps,
    type GoogleInfoWindow,
    type GoogleLatLng,
    type GoogleMapInstance,
    type GoogleMapMouseEvent,
    type GoogleMapType,
    type GoogleOverlay,
} from '@/lib/google-maps';
import type { MapFeature, RegistryPayload } from '@/types/admin-dashboard';

const polygonPalette = [
    '#f5c518',
    '#38bdf8',
    '#fb7185',
    '#f97316',
    '#c084fc',
    '#22d3ee',
    '#f43f5e',
    '#facc15',
    '#818cf8',
    '#fb923c',
    '#e879f9',
    '#fbbf24',
];

function polygonColor(id: number): string {
    const index = Math.abs(id) % polygonPalette.length;

    return polygonPalette[index];
}

function positions(feature: MapFeature): [number, number][] {
    const ring = feature.boundary?.coordinates[0] ?? [];

    return ring.map(([longitude, latitude]) => [latitude, longitude]);
}

function toLatLng([latitude, longitude]: [number, number]): GoogleLatLng {
    return { lat: latitude, lng: longitude };
}

function featurePosition(feature: MapFeature, layer: string): GoogleLatLng | null {
    const ring = positions(feature);
    const pointsOnly = layer === 'locations' || layer === 'missing';

    if (!pointsOnly && ring.length > 2) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        const closed = first[0] === last[0] && first[1] === last[1];
        const unique = closed ? ring.slice(0, -1) : ring;

        if (unique.length === 0) {
            return null;
        }

        return {
            lat: unique.reduce((sum, point) => sum + point[0], 0) / unique.length,
            lng: unique.reduce((sum, point) => sum + point[1], 0) / unique.length,
        };
    }

    if (feature.latitude !== null && feature.longitude !== null) {
        return { lat: feature.latitude, lng: feature.longitude };
    }

    return null;
}

function eventPosition(event?: GoogleMapMouseEvent): GoogleLatLng | null {
    const latLng = event?.latLng;

    if (!latLng) {
        return null;
    }

    return { lat: latLng.lat(), lng: latLng.lng() };
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function bubbleMarkup(feature: MapFeature): string {
    const verified =
        feature.verified_area_hectares === null
            ? ''
            : `<p style="margin:2px 0 0">Verified: ${feature.verified_area_hectares.toFixed(2)} ha</p>`;

    return `<div style="padding:2px 0;line-height:1.4;color:#1c1917">
        <p style="margin:0;font-weight:600">${escapeHtml(feature.farm_name)}</p>
        <p style="margin:4px 0 0">Farmer: ${escapeHtml(feature.farmer_name)}</p>
        <p style="margin:2px 0 0">Area: ${feature.declared_area_hectares.toFixed(2)} ha</p>
        ${verified}
    </div>`;
}

export function AdminRegistryMap({ registry }: { registry: RegistryPayload }) {
    const { map, options, filters } = registry;
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [mapType, setMapType] = useState<GoogleMapType>('hybrid');
    const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
    const mapHost = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<GoogleMapInstance | null>(null);
    const overlays = useRef<GoogleOverlay[]>([]);
    const infoWindow = useRef<GoogleInfoWindow | null>(null);
    const bubbleAnchor = useRef<{ id: number; position: GoogleLatLng } | null>(null);
    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
    const selected = map.features.find((feature) => feature.id === selectedId) ?? null;
    const drawable = useMemo(() => map.features.filter((feature) => {
        const hasRing = (feature.boundary?.coordinates[0]?.length ?? 0) > 2;
        const hasPoint = feature.latitude !== null && feature.longitude !== null;
        const pointsOnly = map.layer === 'locations' || map.layer === 'missing';

        return pointsOnly ? hasPoint : hasRing || hasPoint;
    }), [map.features, map.layer]);
    const focus = useMemo(() => drawable.flatMap((feature) => {
        const ring = positions(feature);

        if (ring.length > 0 && map.layer !== 'locations' && map.layer !== 'missing') {
            return ring;
        }

        if (feature.latitude !== null && feature.longitude !== null) {
            return [[feature.latitude, feature.longitude] as [number, number]];
        }

        return [];
    }), [drawable, map.layer]);

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
                infoWindow.current = new window.google.maps.InfoWindow({
                    maxWidth: 280,
                    disableAutoPan: true,
                });
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
            const color = polygonColor(feature.id);
            const ring = positions(feature);
            const showPolygon = ring.length > 2 && map.layer !== 'locations' && map.layer !== 'missing';

            if (showPolygon) {
                const path = ring.map(toLatLng);
                const polygon = new maps.Polygon({
                    map: instance,
                    paths: path,
                    strokeColor: '#ffffff',
                    strokeOpacity: feature.status === 'inactive' ? 0 : 1,
                    strokeWeight: 2,
                    fillColor: color,
                    fillOpacity: 0.45,
                    clickable: true,
                });
                polygon.addListener('click', (event) => {
                    const position = eventPosition(event) ?? featurePosition(feature, map.layer);

                    if (position !== null) {
                        bubbleAnchor.current = { id: feature.id, position };
                        openFarmBubble(feature, position);
                    }

                    setSelectedId(feature.id);
                });
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
                                scale: 2,
                            },
                            offset: '0',
                            repeat: '10px',
                        }],
                        clickable: false,
                    }));
                }

                return;
            }

            const latitude = feature.latitude;
            const longitude = feature.longitude;

            if (latitude === null || longitude === null) {
                return;
            }

            const marker = new maps.Marker({
                map: instance,
                position: { lat: latitude, lng: longitude },
                clickable: true,
                icon: {
                    path: maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: color,
                    fillOpacity: 0.9,
                    strokeColor: color,
                    strokeWeight: 2,
                },
            });
            marker.addListener('click', (event) => {
                const position = eventPosition(event) ?? { lat: latitude, lng: longitude };
                bubbleAnchor.current = { id: feature.id, position };
                openFarmBubble(feature, position);
                setSelectedId(feature.id);
            });
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
    }, [drawable, focus, map.layer, mapStatus]);

    useEffect(() => {
        const popup = infoWindow.current;
        const instance = mapInstance.current;

        if (popup === null || instance === null || mapStatus !== 'ready') {
            return;
        }

        if (selected === null) {
            popup.close();

            return;
        }

        const stored = bubbleAnchor.current;
        const position = stored?.id === selected.id
            ? stored.position
            : featurePosition(selected, map.layer);

        if (position === null) {
            popup.close();

            return;
        }

        openFarmBubble(selected, position);
    }, [map.layer, mapStatus, selected]);

    function openFarmBubble(feature: MapFeature, position: GoogleLatLng): void {
        const popup = infoWindow.current;
        const instance = mapInstance.current;

        if (popup === null || instance === null) {
            return;
        }

        popup.setContent(bubbleMarkup(feature));
        popup.setPosition(position);
        popup.open(instance);
    }

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
            <p className="text-xs text-muted-foreground">
                Each farm has its own color so neighboring boundaries stay separate on the satellite image. Click a boundary or point to see the farmer and hectares.
            </p>
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
                            <button type="button" className="flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/60" onClick={() => onSelect(item.id)}>
                                <span
                                    className="mt-1 size-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: polygonColor(item.id) }}
                                />
                                <span className="min-w-0">
                                    <span className="block font-medium">{item.farm_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {item.farm_id} · {item.verification_label} · {item.boundary_status === 'mapped' ? 'Boundary saved' : 'No boundary'}
                                    </span>
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
            <div className="flex items-start gap-2">
                <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: polygonColor(feature.id) }}
                />
                <div>
                    <p className="text-sm font-medium">{feature.farm_name}</p>
                    <p className="text-xs text-muted-foreground">{feature.farm_id}</p>
                </div>
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
