const EARTH_RADIUS_METERS = 6378137;

function radians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Spherical polygon area from Chamberlain and Duquette,
 * "Some Algorithms for Polygons on a Sphere" (JPL 07-03).
 * Matches App\Services\SphericalPolygonArea. The ring is a closed
 * GeoJSON ring of [longitude, latitude] positions.
 */
export function sphericalPolygonHectares(ring: [number, number][]): number {
    const count = ring.length;
    let area = 0;

    if (count > 2) {
        for (let index = 0; index < count; index++) {
            let lower = index;
            let middle = index + 1;
            let upper = index + 2;

            if (index === count - 2) {
                lower = count - 2;
                middle = count - 1;
                upper = 0;
            } else if (index === count - 1) {
                lower = count - 1;
                middle = 0;
                upper = 1;
            }

            area +=
                (radians(ring[upper][0]) - radians(ring[lower][0])) *
                Math.sin(radians(ring[middle][1]));
        }

        area = (area * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2;
    }

    return Math.round((Math.abs(area) / 10000) * 100) / 100;
}
