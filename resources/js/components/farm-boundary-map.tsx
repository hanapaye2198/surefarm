import { router, useForm } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CircleMarker,
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    TileLayer,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import { GoogleBasemap } from '@/components/google-basemap';
import { StatusBadge } from '@/components/status-badge';
import type { FarmStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    useGoogleMapsApiKey,
    type GoogleMapType,
} from '@/lib/google-maps';
import { sphericalPolygonHectares } from '@/lib/spherical-polygon-area';
import { destroy, store, update } from '@/routes/farms/boundary';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export type BoundaryGeoJson = {
    type: 'Polygon';
    coordinates: [number, number][][];
};

type MapPoint = {
    latitude: number;
    longitude: number;
};

type SavedBoundary = {
    geojson: BoundaryGeoJson;
    gps_measured_area_hectares: number;
    captured_by: string | null;
    captured_at: string | null;
    updated_by: string | null;
    updated_at: string | null;
};

type Mode = 'view' | 'draw' | 'preview' | 'edit';

/**
 * Camera used only when a farm has no recorded location.
 * It is not stored and it is not a farm location.
 */
const DEFAULT_VIEW = {
    latitude: 8.05,
    longitude: 125.1,
    zoom: 11,
};

const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const vertexIcon = L.divIcon({
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#2f6b45;border:2px solid #fff;box-shadow:0 0 0 1px #2f6b45"></span>',
});

function roundCoordinate(value: number): number {
    return Math.round(value * 1e7) / 1e7;
}

function openRing(geojson: BoundaryGeoJson): MapPoint[] {
    const ring = geojson.coordinates[0] ?? [];
    const positions = ring.length > 1 ? ring.slice(0, -1) : ring;

    return positions.map(([longitude, latitude]) => ({
        latitude,
        longitude,
    }));
}

function closedRing(points: MapPoint[]): [number, number][] {
    const ring = points.map(
        (point) =>
            [
                roundCoordinate(point.longitude),
                roundCoordinate(point.latitude),
            ] as [number, number],
    );

    if (ring.length === 0) {
        return ring;
    }

    const first = ring[0];
    const last = ring[ring.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
    }

    return ring;
}

function hectaresLabel(value: number): string {
    return `${areaFormatter.format(value)} ha`;
}

function MapViewport({
    active,
    drawing,
    fitKey,
    positions,
}: {
    active: boolean;
    drawing: boolean;
    fitKey: string;
    positions: [number, number][];
}) {
    const map = useMap();
    const fitted = useRef('');

    useEffect(() => {
        if (!active) {
            return;
        }

        map.invalidateSize();

        if (
            fitKey === '' ||
            fitted.current === fitKey ||
            positions.length < 2
        ) {
            return;
        }

        fitted.current = fitKey;
        map.fitBounds(positions, { padding: [28, 28] });
    }, [active, fitKey, map, positions]);

    useEffect(() => {
        map.getContainer().style.cursor = drawing ? 'crosshair' : '';

        return () => {
            map.getContainer().style.cursor = '';
        };
    }, [drawing, map]);

    return null;
}

function DrawClicks({
    enabled,
    onAdd,
}: {
    enabled: boolean;
    onAdd: (latitude: number, longitude: number) => void;
}) {
    useMapEvents({
        click(event) {
            if (!enabled) {
                return;
            }

            onAdd(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
}

export function FarmBoundaryMap({
    farm,
    boundary,
    active,
    inspection = false,
}: {
    farm: {
        id: number;
        farm_name: string;
        declared_area_hectares: number;
        verification_status: FarmStatus;
        latitude: string | null;
        longitude: string | null;
        farmer_name: string;
        can_manage_boundary: boolean;
        can_remove_boundary: boolean;
    };
    boundary: SavedBoundary | null;
    active: boolean;
    inspection?: boolean;
}) {
    const [mode, setMode] = useState<Mode>('view');
    const [points, setPoints] = useState<MapPoint[]>([]);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [mapType, setMapType] = useState<GoogleMapType>('hybrid');
    const [googleReady, setGoogleReady] = useState(false);
    const [googleFailed, setGoogleFailed] = useState(false);
    const googleHost = useRef<HTMLDivElement>(null);
    const googleApiKey = useGoogleMapsApiKey();
    const markGoogleReady = useCallback(() => setGoogleReady(true), []);
    const markGoogleFailed = useCallback(() => setGoogleFailed(true), []);
    const form = useForm<{ boundary_geojson: BoundaryGeoJson | null }>({
        boundary_geojson: null,
    });

    const hasLocation =
        farm.latitude !== null &&
        farm.longitude !== null &&
        farm.latitude !== '' &&
        farm.longitude !== '' &&
        !Number.isNaN(Number(farm.latitude)) &&
        !Number.isNaN(Number(farm.longitude));
    const location = hasLocation
        ? {
              latitude: Number(farm.latitude),
              longitude: Number(farm.longitude),
          }
        : null;
    const savedPoints = useMemo(
        () => (boundary ? openRing(boundary.geojson) : []),
        [boundary],
    );
    const workingPoints = mode === 'view' ? savedPoints : points;
    const closed = closedRing(workingPoints);
    const previewHectares =
        mode !== 'view' && closed.length >= 4
            ? sphericalPolygonHectares(closed)
            : null;
    const measuredHectares =
        previewHectares ?? boundary?.gps_measured_area_hectares ?? null;
    const difference =
        measuredHectares === null
            ? null
            : Math.round(
                  Math.abs(farm.declared_area_hectares - measuredHectares) *
                      100,
              ) / 100;
    const variance =
        difference === null || farm.declared_area_hectares <= 0
            ? null
            : Math.round((difference / farm.declared_area_hectares) * 10000) /
              100;
    const polygonPositions = workingPoints.map(
        (point) => [point.latitude, point.longitude] as [number, number],
    );
    const showPolygon = workingPoints.length >= 3 && mode !== 'draw';
    const center = location ?? DEFAULT_VIEW;

    function beginDraw() {
        setPoints([]);
        setMode('draw');
        form.clearErrors();
    }

    function beginEdit() {
        setPoints(savedPoints);
        setMode('edit');
        form.clearErrors();
    }

    function cancelEditing() {
        setPoints([]);
        setMode('view');
        form.clearErrors();
    }

    function finishDrawing() {
        if (points.length < 3) {
            return;
        }

        setMode('preview');
    }

    function saveBoundary() {
        const geojson: BoundaryGeoJson = {
            type: 'Polygon',
            coordinates: [closedRing(points)],
        };

        form.transform(() => ({ boundary_geojson: geojson }));

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setMode('view');
                setPoints([]);
            },
        };

        if (boundary === null) {
            form.post(store.url(farm.id), options);

            return;
        }

        form.put(update.url(farm.id), options);
    }

    function removeBoundary() {
        router.delete(destroy.url(farm.id), {
            preserveScroll: true,
            onSuccess: () => {
                setConfirmRemove(false);
                setMode('view');
                setPoints([]);
            },
        });
    }

    return (
        <div
            className={
                inspection
                    ? undefined
                    : 'grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]'
            }
        >
            {!inspection && (
                <aside className="flex flex-col gap-4 rounded-xl border bg-card p-4">
                    <div>
                        <h2 className="text-base font-semibold">Farm Map</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            The location marker is a reference point. The
                            boundary is the polygon drawn on the map.
                        </p>
                    </div>
                    <dl className="grid gap-3 text-sm">
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Farm
                            </dt>
                            <dd className="font-medium">{farm.farm_name}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Farmer
                            </dt>
                            <dd>{farm.farmer_name}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <dt className="text-xs text-muted-foreground">
                                Verification
                            </dt>
                            <dd>
                                <StatusBadge
                                    status={farm.verification_status}
                                />
                            </dd>
                        </div>
                    </dl>
                    <dl className="grid gap-2 border-t pt-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">
                                Declared Area
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {hectaresLabel(farm.declared_area_hectares)}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">
                                Web Measured Area
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {measuredHectares === null
                                    ? 'Not yet measured'
                                    : hectaresLabel(measuredHectares)}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">
                                Difference
                            </dt>
                            <dd className="tabular-nums">
                                {difference === null
                                    ? '—'
                                    : hectaresLabel(difference)}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">Variance</dt>
                            <dd className="tabular-nums">
                                {variance === null
                                    ? '—'
                                    : `${areaFormatter.format(variance)}%`}
                            </dd>
                        </div>
                    </dl>
                    <div className="grid gap-1 border-t pt-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                            Farm Location
                        </p>
                        <p>
                            {location
                                ? `${location.latitude}, ${location.longitude}`
                                : 'Farm location has not been recorded yet.'}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Farm Boundary
                        </p>
                        <p>
                            {boundary
                                ? 'Boundary Captured'
                                : 'No farm boundary has been captured yet.'}
                        </p>
                        {boundary && mode === 'view' && (
                            <>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Captured By
                                </p>
                                <p>{boundary.captured_by ?? '—'}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Captured At
                                </p>
                                <p>{boundary.captured_at ?? '—'}</p>
                                {boundary.updated_by && (
                                    <>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Updated By
                                        </p>
                                        <p>{boundary.updated_by}</p>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    {mode === 'view' && boundary === null && (
                        <p className="text-sm text-muted-foreground">
                            Use the map to draw and save the farm boundary.
                        </p>
                    )}
                    {mode === 'draw' && (
                        <p className="text-sm text-muted-foreground">
                            Click on the map to add boundary points.
                        </p>
                    )}
                    {mode === 'preview' && (
                        <p className="text-sm font-medium">Boundary Preview</p>
                    )}
                    {previewHectares !== null && mode !== 'view' && (
                        <p className="text-xs text-muted-foreground">
                            This preview is not saved until you click Save
                            Boundary. It does not verify the farm.
                        </p>
                    )}
                    {form.errors.boundary_geojson && (
                        <p className="text-sm text-destructive">
                            {form.errors.boundary_geojson}
                        </p>
                    )}
                    <div className="mt-auto flex flex-col gap-2">
                        {mode === 'view' &&
                            boundary === null &&
                            farm.can_manage_boundary && (
                                <Button type="button" onClick={beginDraw}>
                                    Draw Boundary
                                </Button>
                            )}
                        {mode === 'view' &&
                            boundary !== null &&
                            farm.can_manage_boundary && (
                                <Button type="button" onClick={beginEdit}>
                                    Edit Boundary
                                </Button>
                            )}
                        {mode === 'view' &&
                            boundary !== null &&
                            farm.can_remove_boundary && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setConfirmRemove(true)}
                                >
                                    Remove Boundary
                                </Button>
                            )}
                        {mode === 'draw' && (
                            <>
                                <Button
                                    type="button"
                                    onClick={finishDrawing}
                                    disabled={points.length < 3}
                                >
                                    Finish Boundary
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setPoints([])}
                                    disabled={points.length === 0}
                                >
                                    Clear Boundary
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={cancelEditing}
                                >
                                    Cancel
                                </Button>
                            </>
                        )}
                        {(mode === 'preview' || mode === 'edit') && (
                            <>
                                <Button
                                    type="button"
                                    onClick={saveBoundary}
                                    disabled={
                                        form.processing ||
                                        workingPoints.length < 3
                                    }
                                >
                                    Save Boundary
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={beginDraw}
                                >
                                    {mode === 'preview'
                                        ? 'Redraw'
                                        : 'Clear Boundary'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={cancelEditing}
                                >
                                    Cancel
                                </Button>
                            </>
                        )}
                    </div>
                </aside>
            )}

            <div className="farm-boundary-map relative min-h-96 overflow-hidden rounded-xl border">
                {!hasLocation && (
                    <p className="border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                        Farm location has not been recorded yet. The map view is
                        a starting point, not this farm&apos;s location.
                    </p>
                )}
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
                <div className="relative h-[32rem]">
                    <div
                        ref={googleHost}
                        className="pointer-events-none absolute inset-0 z-0"
                        aria-hidden={googleReady ? undefined : true}
                    />
                    <MapContainer
                        center={[center.latitude, center.longitude]}
                        zoom={location ? 16 : DEFAULT_VIEW.zoom}
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
                        <MapViewport
                            active={active}
                            drawing={mode === 'draw'}
                            fitKey={
                                mode === 'view' && boundary
                                    ? JSON.stringify(
                                          boundary.geojson.coordinates,
                                      )
                                    : ''
                            }
                            positions={polygonPositions}
                        />
                        <DrawClicks
                            enabled={mode === 'draw'}
                            onAdd={(latitude, longitude) =>
                                setPoints((current) => [
                                    ...current,
                                    {
                                        latitude: roundCoordinate(latitude),
                                        longitude: roundCoordinate(longitude),
                                    },
                                ])
                            }
                        />
                        {location && (
                            <CircleMarker
                                center={[location.latitude, location.longitude]}
                                radius={8}
                                pathOptions={{
                                    color: '#8a5a32',
                                    fillColor: '#8a5a32',
                                    fillOpacity: 0.9,
                                    weight: 2,
                                }}
                            />
                        )}
                        {mode === 'draw' && polygonPositions.length > 1 && (
                            <Polyline
                                positions={polygonPositions}
                                pathOptions={{ color: '#2f6b45', weight: 2 }}
                            />
                        )}
                        {showPolygon && (
                            <Polygon
                                positions={polygonPositions}
                                pathOptions={{
                                    color: '#2f6b45',
                                    fillColor: '#2f6b45',
                                    fillOpacity: 0.28,
                                    weight: 2,
                                }}
                            />
                        )}
                        {mode === 'draw' &&
                            polygonPositions.map((position, index) => (
                                <CircleMarker
                                    key={`${position[0]}-${position[1]}-${index}`}
                                    center={position}
                                    radius={5}
                                    pathOptions={{
                                        color: '#ffffff',
                                        fillColor: '#2f6b45',
                                        fillOpacity: 1,
                                        weight: 2,
                                    }}
                                />
                            ))}
                        {mode === 'edit' &&
                            points.map((point, index) => (
                                <Marker
                                    key={`vertex-${index}`}
                                    position={[point.latitude, point.longitude]}
                                    icon={vertexIcon}
                                    draggable
                                    eventHandlers={{
                                        dragend: (event) => {
                                            const marker =
                                                event.target as L.Marker;
                                            const next = marker.getLatLng();
                                            setPoints((current) =>
                                                current.map(
                                                    (item, itemIndex) =>
                                                        itemIndex === index
                                                            ? {
                                                                  latitude:
                                                                      roundCoordinate(
                                                                          next.lat,
                                                                      ),
                                                                  longitude:
                                                                      roundCoordinate(
                                                                          next.lng,
                                                                      ),
                                                              }
                                                            : item,
                                                ),
                                            );
                                        },
                                    }}
                                />
                            ))}
                    </MapContainer>
                </div>
            </div>

            <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove boundary?</DialogTitle>
                        <DialogDescription>
                            This removes the saved polygon and web measured
                            area. Declared area and verification status stay
                            unchanged.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmRemove(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={removeBoundary}
                        >
                            Remove Boundary
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
