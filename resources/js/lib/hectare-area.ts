export type HectareBand = {
    label: string;
    color: string;
    min: number;
    max: number | null;
};

export const hectareBands: HectareBand[] = [
    { label: 'Under 1 ha', color: '#0284c7', min: 0, max: 1 },
    { label: '1–2 ha', color: '#16a34a', min: 1, max: 2 },
    { label: '2–3 ha', color: '#ca8a04', min: 2, max: 3 },
    { label: '3–5 ha', color: '#ea580c', min: 3, max: 5 },
    { label: '5 ha and above', color: '#7c3aed', min: 5, max: null },
];

const METERS_PER_DEGREE = 111_320;

export function hectareBand(hectares: number): HectareBand {
    return (
        hectareBands.find((band) => band.max === null || hectares < band.max) ??
        hectareBands[hectareBands.length - 1]
    );
}

export function hectareColor(hectares: number): string {
    return hectareBand(hectares).color;
}

/**
 * Square around a recorded point whose area matches the given hectares.
 * Positions are Leaflet [latitude, longitude] pairs.
 */
export function areaSquarePositions(
    latitude: number,
    longitude: number,
    hectares: number,
): [number, number][] {
    const side = Math.sqrt(Math.max(hectares, 0.01) * 10_000);
    const half = side / 2;
    const latitudeDelta = half / METERS_PER_DEGREE;
    const longitudeScale = Math.cos((latitude * Math.PI) / 180);
    const longitudeDelta =
        half / (METERS_PER_DEGREE * Math.max(Math.abs(longitudeScale), 0.2));

    return [
        [latitude - latitudeDelta, longitude - longitudeDelta],
        [latitude - latitudeDelta, longitude + longitudeDelta],
        [latitude + latitudeDelta, longitude + longitudeDelta],
        [latitude + latitudeDelta, longitude - longitudeDelta],
    ];
}
