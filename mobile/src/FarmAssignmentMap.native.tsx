import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

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

function pinColor(status: string): string {
    return (
        (
            {
                pending: '#d69219',
                in_progress: '#4384d5',
                verified: '#348758',
                failed: '#c74848',
                needs_review: '#bd6c25',
            } as Record<string, string>
        )[status] ?? '#60746a'
    );
}

type Props = {
    farms: FarmPin[];
    apiKey?: string;
    onSelect: (farm: FarmPin) => void;
    height?: number;
};

export default function FarmAssignmentMap({
    farms,
    onSelect,
    height = 230,
}: Props) {
    const map = useRef<MapView | null>(null);
    const pins = useMemo(
        () =>
            farms.filter(
                (farm) =>
                    Number.isFinite(Number(farm.latitude)) &&
                    Number.isFinite(Number(farm.longitude)),
            ),
        [farms],
    );
    const coordinates = pins.map((farm) => ({
        latitude: Number(farm.latitude),
        longitude: Number(farm.longitude),
    }));
    const center = coordinates[0] ?? { latitude: 8.16, longitude: 125.13 };

    useEffect(() => {
        if (coordinates.length > 1) {
            map.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                animated: false,
            });
        }
    }, [pins]);

    if (!pins.length) return null;

    return (
        <MapView
            ref={map}
            style={[styles.map, { height }]}
            mapType="hybrid"
            initialRegion={{
                ...center,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
            }}
            toolbarEnabled={false}
        >
            {pins.map((farm) => (
                <Marker
                    key={farm.id}
                    coordinate={{
                        latitude: Number(farm.latitude),
                        longitude: Number(farm.longitude),
                    }}
                    pinColor={pinColor(farm.verification_status)}
                    title={farm.farm_name}
                    description={`${farm.farmer_name ?? 'Farmer'} · ${farm.verification_status.replaceAll('_', ' ')}`}
                    onPress={() => onSelect(farm)}
                />
            ))}
        </MapView>
    );
}

const styles = StyleSheet.create({
    map: { width: '100%', overflow: 'hidden', borderRadius: 14 },
});
