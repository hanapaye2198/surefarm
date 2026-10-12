import React, { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type FarmPin = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string | null;
    location: string;
    latitude: number;
    longitude: number;
    verification_status: string;
};

type Props = {
    farms: FarmPin[];
    apiKey?: string;
    onSelect: (farm: FarmPin) => void;
    height?: number;
};

const PIN_COLORS: Record<string, string> = {
    pending: '#d69219',
    in_progress: '#4384d5',
    verified: '#348758',
    failed: '#c74848',
    needs_review: '#bd6c25',
};

export function pinColor(status: string): string {
    return PIN_COLORS[status] ?? '#60746a';
}

export default function FarmAssignmentMap({
    farms,
    apiKey,
    onSelect,
    height = 230,
}: Props) {
    const mapHost = useRef<HTMLDivElement | null>(null);
    const [mapUnavailable, setMapUnavailable] = useState(false);
    const onSelectRef = useRef(onSelect);
    const pins = useMemo(
        () =>
            farms.filter(
                (farm) =>
                    Number.isFinite(Number(farm.latitude)) &&
                    Number.isFinite(Number(farm.longitude)),
            ),
        [farms],
    );
    const projected = useMemo(() => {
        if (!pins.length) return [];
        const longitudes = pins.map((farm) => Number(farm.longitude));
        const latitudes = pins.map((farm) => Number(farm.latitude));
        const minLongitude = Math.min(...longitudes);
        const maxLongitude = Math.max(...longitudes);
        const minLatitude = Math.min(...latitudes);
        const maxLatitude = Math.max(...latitudes);
        const width = maxLongitude - minLongitude || 0.0001;
        const mapHeight = maxLatitude - minLatitude || 0.0001;
        const scale = Math.min(250 / width, 100 / mapHeight);
        const offsetX = (320 - width * scale) / 2;
        const offsetY = (140 - mapHeight * scale) / 2;

        return pins.map((farm) => ({
            farm,
            x: offsetX + (Number(farm.longitude) - minLongitude) * scale,
            y: offsetY + (maxLatitude - Number(farm.latitude)) * scale,
        }));
    }, [pins]);

    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    useEffect(() => {
        if (
            Platform.OS !== 'web' ||
            !apiKey ||
            pins.length === 0 ||
            !mapHost.current
        )
            return;

        const browserWindow = window as any;
        let cancelled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let markers: any[] = [];
        const previousAuthFailure = browserWindow.gm_authFailure;
        const handleAuthFailure = () => {
            if (!cancelled) setMapUnavailable(true);
            if (typeof previousAuthFailure === 'function') previousAuthFailure();
        };
        const renderMap = () => {
            if (cancelled || !mapHost.current || !browserWindow.google?.maps) return;
            if (timeout) clearTimeout(timeout);
            try {
                const googleMaps = browserWindow.google.maps;
                const map = new googleMaps.Map(mapHost.current, {
                    mapTypeId: 'hybrid',
                    mapTypeControl: true,
                    streetViewControl: false,
                    fullscreenControl: true,
                    gestureHandling: 'greedy',
                });
                const bounds = new googleMaps.LatLngBounds();
                markers = pins.map((farm) => {
                    const position = {
                        lat: Number(farm.latitude),
                        lng: Number(farm.longitude),
                    };
                    bounds.extend(position);
                    const marker = new googleMaps.Marker({
                        map,
                        position,
                        title: `${farm.farm_name} · ${farm.verification_status.replaceAll('_', ' ')}`,
                        icon: {
                            path: googleMaps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: pinColor(farm.verification_status),
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 2,
                        },
                    });
                    marker.addListener('click', () => onSelectRef.current(farm));
                    return marker;
                });
                if (pins.length === 1) {
                    map.setCenter({
                        lat: Number(pins[0].latitude),
                        lng: Number(pins[0].longitude),
                    });
                    map.setZoom(14);
                } else {
                    map.fitBounds(bounds, 32);
                }
                setMapUnavailable(false);
            } catch {
                setMapUnavailable(true);
            }
        };
        const handleScriptError = () => setMapUnavailable(true);

        setMapUnavailable(false);
        browserWindow.gm_authFailure = handleAuthFailure;
        if (browserWindow.google?.maps) {
            renderMap();
        } else {
            let script = document.querySelector<HTMLScriptElement>(
                '#surefarm-google-maps',
            );
            if (!script) {
                script = document.createElement('script');
                script.id = 'surefarm-google-maps';
                script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
            script.addEventListener('load', renderMap);
            script.addEventListener('error', handleScriptError);
            timeout = setTimeout(handleScriptError, 15000);
        }

        return () => {
            cancelled = true;
            if (timeout) clearTimeout(timeout);
            markers.forEach((marker) => marker.setMap(null));
            document
                .querySelector<HTMLScriptElement>('#surefarm-google-maps')
                ?.removeEventListener('load', renderMap);
            document
                .querySelector<HTMLScriptElement>('#surefarm-google-maps')
                ?.removeEventListener('error', handleScriptError);
            if (browserWindow.gm_authFailure === handleAuthFailure)
                browserWindow.gm_authFailure = previousAuthFailure;
        };
    }, [apiKey, pins]);

    if (!pins.length) {
        return (
            <View
                style={{
                    height,
                    borderRadius: 14,
                    backgroundColor: '#f1f5f1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                }}
            >
                <Text style={{ color: '#6f7d73', textAlign: 'center' }}>
                    Assigned farms with GPS coordinates will appear here.
                </Text>
            </View>
        );
    }

    if (Platform.OS === 'web' && apiKey && !mapUnavailable) {
        return createElement('div', {
            ref: mapHost,
            style: {
                width: '100%',
                height,
                borderRadius: 14,
                overflow: 'hidden',
            },
        });
    }

    return (
        <View
            style={{
                height,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#f1f5f1',
            }}
        >
            <Svg width="100%" height="100%" viewBox="0 0 320 140">
                <Path
                    d="M0 35H320 M0 70H320 M0 105H320 M80 0V140 M160 0V140 M240 0V140"
                    stroke="#dce7dd"
                    strokeWidth={1}
                />
                {projected.map(({ farm, x, y }) => (
                    <Circle
                        key={farm.id}
                        cx={x}
                        cy={y}
                        r={8}
                        fill={pinColor(farm.verification_status)}
                        stroke="#ffffff"
                        strokeWidth={2}
                        onPress={() => onSelect(farm)}
                    />
                ))}
            </Svg>
            {Platform.OS === 'web' && apiKey && mapUnavailable ? (
                <View
                    style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        right: 10,
                        backgroundColor: '#ffffffdd',
                        borderRadius: 10,
                        padding: 8,
                    }}
                >
                    <Text style={{ color: '#58675c', fontSize: 12 }}>
                        Google Maps is unavailable. Showing assignment pins; tap one to open its record.
                    </Text>
                </View>
            ) : null}
        </View>
    );
}
