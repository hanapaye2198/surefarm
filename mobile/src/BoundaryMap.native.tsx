import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import type { BoundaryPoint } from './BoundaryMap';

type Props = {
    points: BoundaryPoint[];
    height?: number;
};

export default function BoundaryMap({ points, height = 210 }: Props) {
    const map = useRef<MapView | null>(null);
    const validPoints = useMemo(
        () => points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
        [points],
    );
    const center = validPoints[0] ?? { latitude: 8.16, longitude: 125.13 };

    useEffect(() => {
        if (validPoints.length > 1) {
            map.current?.fitToCoordinates(validPoints, {
                edgePadding: { top: 44, right: 44, bottom: 44, left: 44 },
                animated: false,
            });
        } else if (validPoints.length === 1) {
            map.current?.animateToRegion({
                ...center,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
            }, 250);
        }
    }, [validPoints, center]);

    return (
        <MapView
            ref={map}
            style={[styles.map, { height }]}
            mapType="hybrid"
            initialRegion={{ ...center, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            toolbarEnabled={false}
        >
            {validPoints.length > 1 && validPoints.length < 3 && (
                <Polyline coordinates={validPoints} strokeColor="#17613d" strokeWidth={3} />
            )}
            {validPoints.length >= 3 && (
                <Polygon
                    coordinates={validPoints}
                    strokeColor="#17613d"
                    strokeWidth={3}
                    fillColor="rgba(112, 184, 59, 0.24)"
                />
            )}
            {validPoints.map((point, index) => (
                <Marker
                    key={`${point.latitude}-${point.longitude}-${index}`}
                    coordinate={point}
                    title={`GPS point ${index + 1}`}
                />
            ))}
        </MapView>
    );
}

const styles = StyleSheet.create({
    map: { width: '100%', overflow: 'hidden', borderRadius: 14 },
});
