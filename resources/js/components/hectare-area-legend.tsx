import { hectareBands } from '@/lib/hectare-area';

export function HectareAreaLegend() {
    return (
        <ul
            aria-label="Polygon colors by hectares"
            className="flex flex-wrap gap-x-3 gap-y-1"
        >
            {hectareBands.map((band) => (
                <li
                    key={band.label}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                    <span
                        className="size-2.5 rounded-sm"
                        style={{ backgroundColor: band.color }}
                    />
                    {band.label}
                </li>
            ))}
        </ul>
    );
}
