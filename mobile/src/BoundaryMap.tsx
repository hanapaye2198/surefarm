import React, {
    createElement,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

export type BoundaryPoint = { latitude: number; longitude: number };

type Props = {
    points: BoundaryPoint[];
    height?: number;
    apiKey?: string;
};

export default function BoundaryMap({ points, height = 210, apiKey }: Props) {
    const mapHost = useRef<HTMLDivElement | null>(null);
    const [mapUnavailable, setMapUnavailable] = useState(false);
    const plotPoints = useMemo(() => {
        if (points.length === 0) return [];
        const longitudes = points.map((point) => point.longitude);
        const latitudes = points.map((point) => point.latitude);
        const minLongitude = Math.min(...longitudes);
        const maxLongitude = Math.max(...longitudes);
        const minLatitude = Math.min(...latitudes);
        const maxLatitude = Math.max(...latitudes);
        const width = maxLongitude - minLongitude || 0.00001;
        const height = maxLatitude - minLatitude || 0.00001;
        const scale = Math.min(250 / width, 105 / height);
        const offsetX = (320 - width * scale) / 2;
        const offsetY = (140 - height * scale) / 2;

        return points.map((point) => {
            const x = offsetX + (point.longitude - minLongitude) * scale;
            const y = offsetY + (maxLatitude - point.latitude) * scale;
            return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
        });
    }, [points]);
    const polygonPoints = plotPoints.map(({ x, y }) => `${x},${y}`).join(' ');

    useEffect(() => {
        if (
            Platform.OS !== 'web' ||
            !apiKey ||
            points.length < 3 ||
            !mapHost.current
        )
            return;

        const browserWindow = window as any;
        let cancelled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const previousAuthFailure = browserWindow.gm_authFailure;
        const handleAuthFailure = () => {
            if (!cancelled) setMapUnavailable(true);
            if (typeof previousAuthFailure === 'function')
                previousAuthFailure();
        };
        const renderMap = () => {
            if (cancelled || !mapHost.current || !browserWindow.google?.maps)
                return;
            try {
                const map = new browserWindow.google.maps.Map(mapHost.current, {
                    mapTypeId: 'hybrid',
                    mapTypeControl: true,
                    streetViewControl: false,
                    fullscreenControl: true,
                    gestureHandling: 'greedy',
                });
                const path = points.map((point) => ({
                    lat: point.latitude,
                    lng: point.longitude,
                }));
                new browserWindow.google.maps.Polygon({
                    paths: path,
                    strokeColor: '#17613d',
                    strokeOpacity: 0.95,
                    strokeWeight: 3,
                    fillColor: '#70b83b',
                    fillOpacity: 0.28,
                }).setMap(map);
                const bounds = new browserWindow.google.maps.LatLngBounds();
                path.forEach((point) => bounds.extend(point));
                map.fitBounds(bounds, 24);
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
            document
                .querySelector<HTMLScriptElement>('#surefarm-google-maps')
                ?.removeEventListener('load', renderMap);
            document
                .querySelector<HTMLScriptElement>('#surefarm-google-maps')
                ?.removeEventListener('error', handleScriptError);
            if (browserWindow.gm_authFailure === handleAuthFailure)
                browserWindow.gm_authFailure = previousAuthFailure;
        };
    }, [apiKey, points]);

    if (
        Platform.OS === 'web' &&
        apiKey &&
        points.length >= 3 &&
        !mapUnavailable
    ) {
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
                width: '100%',
                height,
                overflow: 'hidden',
                borderRadius: 14,
                backgroundColor: '#f5f7f4',
            }}
        >
            <Svg
                width="100%"
                height="100%"
                viewBox="0 0 320 140"
                preserveAspectRatio="xMidYMid meet"
            >
                <Path
                    d="M0 35H320 M0 70H320 M0 105H320 M80 0V140 M160 0V140 M240 0V140"
                    stroke="#e6eee7"
                    strokeWidth={1}
                />
                {polygonPoints ? (
                    <Polygon
                        points={polygonPoints}
                        fill="#88b89555"
                        stroke="#17613d"
                        strokeWidth={3}
                        strokeLinejoin="round"
                    />
                ) : null}
                {points.map((point, index) => {
                    const projected = plotPoints[index] ?? { x: 160, y: 70 };
                    return (
                        <Circle
                            key={`${point.latitude}-${point.longitude}-${index}`}
                            cx={projected.x}
                            cy={projected.y}
                            r={4}
                            fill="#17613d"
                            stroke="#fff"
                            strokeWidth={2}
                        />
                    );
                })}
            </Svg>
        </View>
    );
}
