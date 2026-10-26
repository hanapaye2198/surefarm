import { Link } from '@inertiajs/react';
import { visitRegistry } from '@/components/admin-registry-filters';
import { StatusBadge, FarmerStatusBadge } from '@/components/status-badge';
import type { FarmStatus, FarmerRecordStatus } from '@/components/status-badge';
import type { RegistryFarm, RegistryPayload } from '@/types/admin-dashboard';

const area = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const columns: { key: string; label: string; sort?: string }[] = [
    { key: 'farm', label: 'Farm' },
    { key: 'farmer', label: 'Registered farmer', sort: 'farmer' },
    { key: 'location', label: 'Location', sort: 'location' },
    { key: 'crop', label: 'Crop' },
    { key: 'declared', label: 'Declared', sort: 'declared_area' },
    { key: 'verified', label: 'Verified', sort: 'verified_area' },
    { key: 'verification', label: 'Verification' },
    { key: 'status', label: 'Status' },
    { key: 'boundary', label: 'Boundary' },
    { key: 'updated', label: 'Updated', sort: 'updated' },
];

export function AdminRegistryTable({
    registry,
}: {
    registry: RegistryPayload;
}) {
    const { farms, filters } = registry;

    function sort(column: string) {
        const direction =
            filters.sort === column && filters.direction === 'desc'
                ? 'asc'
                : 'desc';

        visitRegistry(filters, { sort: column, direction });
    }

    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="text-muted-foreground">
                    {farms.total === 0
                        ? 'No farms match these filters.'
                        : `Showing ${farms.from ?? 0}–${farms.to ?? 0} of ${farms.total}`}
                </p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Rows
                    <select
                        aria-label="Rows per page"
                        value={filters.per_page}
                        className="h-8 rounded-md border bg-transparent px-2"
                        onChange={(event) =>
                            visitRegistry(filters, {
                                per_page: Number(event.target.value),
                            })
                        }
                    >
                        {[10, 25, 50].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="app-scroll overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[960px] text-sm">
                    <thead className="border-b bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className="px-3 py-2 font-medium whitespace-nowrap"
                                >
                                    {column.sort ? (
                                        <button
                                            type="button"
                                            className="hover:text-foreground"
                                            onClick={() => sort(column.sort!)}
                                        >
                                            {column.label}
                                            {filters.sort === column.sort
                                                ? filters.direction === 'asc'
                                                    ? ' ↑'
                                                    : ' ↓'
                                                : ''}
                                        </button>
                                    ) : (
                                        column.label
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {farms.data.map((farm) => (
                            <tr
                                key={farm.id}
                                className="border-b last:border-0"
                            >
                                <td className="px-3 py-3">
                                    <Link
                                        href={farm.farm_href}
                                        className="font-medium hover:underline"
                                    >
                                        {farm.farm_name}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        {farm.farm_id}
                                    </p>
                                </td>
                                <td className="px-3 py-3">
                                    <Link
                                        href={farm.farmer_href}
                                        className="hover:underline"
                                    >
                                        {farm.farmer_name}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        {farm.farmer_reference}
                                    </p>
                                </td>
                                <td className="px-3 py-3">{place(farm)}</td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    {farm.crop_label}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                                    {area.format(farm.declared_area_hectares)}{' '}
                                    ha
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                                    {farm.verified_area_hectares === null
                                        ? 'Not recorded'
                                        : `${area.format(farm.verified_area_hectares)} ha`}
                                </td>
                                <td className="px-3 py-3">
                                    <StatusBadge
                                        status={
                                            farm.verification_status as FarmStatus
                                        }
                                    />
                                </td>
                                <td className="px-3 py-3">
                                    <FarmerStatusBadge
                                        status={
                                            farm.status as FarmerRecordStatus
                                        }
                                    />
                                    {farm.tenure && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {farm.tenure}
                                        </p>
                                    )}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    {farm.boundary_status === 'mapped'
                                        ? 'Saved'
                                        : 'Missing'}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    {farm.updated_at ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex gap-2">
                {farms.prev_page_url && (
                    <Link
                        href={farms.prev_page_url}
                        preserveScroll
                        className="rounded-md border px-3 py-1.5 text-sm"
                    >
                        Previous
                    </Link>
                )}
                {farms.next_page_url && (
                    <Link
                        href={farms.next_page_url}
                        preserveScroll
                        className="rounded-md border px-3 py-1.5 text-sm"
                    >
                        Next
                    </Link>
                )}
            </div>
        </div>
    );
}

function place(farm: RegistryFarm): string {
    const value = [farm.barangay, farm.municipality, farm.province]
        .filter(Boolean)
        .join(', ');

    return value === '' ? 'Not recorded' : value;
}
