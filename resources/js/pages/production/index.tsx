import { formString } from '@/lib/form-data';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search, Sprout, Tractor, Wheat } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { ProductionStatusBadge } from '@/components/status-badge';
import type { ProductionRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';
import {
    create,
    edit,
    index as productionIndex,
    show,
} from '@/routes/production';

type ProductionRow = {
    id: number;
    production_period: string | null;
    expected_label: string;
    unit: string;
    harvested_label: string;
    remaining_label: string;
    exceeds: boolean;
    status: ProductionRecordStatus;
    crop_label: string;
    farm: { id: number; farm_name: string } | null;
    farmer: { id: number; name: string } | null;
};

type Option = { value: string; label: string };
type FarmOption = { id: number; farm_name: string };
type FarmerOption = { id: number; name: string };

type Paginated = {
    data: ProductionRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type Filters = {
    search: string;
    farm: string;
    farmer: string;
    crop: string;
    period: string;
    status: string;
};

type Summary = {
    total_expected: string;
    farms_in_production: number;
    active_crops: number;
    current_period: string;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const countFormatter = new Intl.NumberFormat('en-US');

export default function ProductionIndex({
    productions,
    summary,
    filters,
    farms,
    farmers,
    crops,
    periods,
    statuses,
    can_record,
}: {
    productions: Paginated;
    summary: Summary;
    filters: Filters;
    farms: FarmOption[];
    farmers: FarmerOption[];
    crops: Option[];
    periods: string[];
    statuses: Option[];
    can_record: boolean;
}) {
    const { auth } = usePage().props;
    const canRecord =
        can_record && userCanAccess(auth.user?.role, ['operations']);
    const hasFilters = Object.values(filters).some(
        (value) => value.trim() !== '',
    );

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        router.get(
            productionIndex.url({
                query: {
                    search: formString(formData, 'search').trim(),
                    farm: formString(formData, 'farm'),
                    farmer: formString(formData, 'farmer'),
                    crop: formString(formData, 'crop'),
                    period: formString(formData, 'period'),
                    status: formString(formData, 'status'),
                },
            }),
            {},
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="Production" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Production"
                    description="Monitor expected production across registered farms."
                    actions={
                        canRecord ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add Production
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    <StatCard
                        label="Total Expected Production"
                        value={summary.total_expected}
                        icon={Wheat}
                    />
                    <StatCard
                        label="Farms in Production"
                        value={countFormatter.format(
                            summary.farms_in_production,
                        )}
                        icon={Tractor}
                    />
                    <StatCard
                        label="Active Crops"
                        value={countFormatter.format(summary.active_crops)}
                        icon={Sprout}
                    />
                    <StatCard
                        label="Current Production Period"
                        value={summary.current_period}
                    />
                </section>

                <form onSubmit={applyFilters} className="grid gap-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            name="search"
                            defaultValue={filters.search}
                            placeholder="Search farmer name, farmer ID, farm ID, or farm name"
                            className="pl-9"
                        />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                        <select
                            name="farmer"
                            defaultValue={filters.farmer}
                            className={selectClassName}
                            aria-label="Farmer"
                        >
                            <option value="">All farmers</option>
                            {farmers.map((farmer) => (
                                <option key={farmer.id} value={farmer.id}>
                                    {farmer.name}
                                </option>
                            ))}
                        </select>
                        <select
                            name="farm"
                            defaultValue={filters.farm}
                            className={selectClassName}
                            aria-label="Farm"
                        >
                            <option value="">All farms</option>
                            {farms.map((farm) => (
                                <option key={farm.id} value={farm.id}>
                                    {farm.farm_name}
                                </option>
                            ))}
                        </select>
                        <select
                            name="crop"
                            defaultValue={filters.crop}
                            className={selectClassName}
                            aria-label="Crop"
                        >
                            <option value="">All crops</option>
                            {crops.map((crop) => (
                                <option key={crop.value} value={crop.value}>
                                    {crop.label}
                                </option>
                            ))}
                        </select>
                        <select
                            name="period"
                            defaultValue={filters.period}
                            className={selectClassName}
                            aria-label="Production period"
                        >
                            <option value="">All periods</option>
                            {periods.map((period) => (
                                <option key={period} value={period}>
                                    {period}
                                </option>
                            ))}
                        </select>
                        <select
                            name="status"
                            defaultValue={filters.status}
                            className={selectClassName}
                            aria-label="Status"
                        >
                            <option value="">All statuses</option>
                            {statuses.map((status) => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <Button type="submit" variant="secondary">
                                Filter
                            </Button>
                            {hasFilters && (
                                <Button variant="outline" asChild>
                                    <Link href={productionIndex()}>Clear</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </form>

                <DataTable
                    columns={[
                        'Farm',
                        'Farmer',
                        'Crop',
                        'Production Period',
                        'Expected Quantity',
                        'Unit',
                        'Harvested Quantity',
                        'Remaining Expected',
                        'Status',
                        'Actions',
                    ]}
                    rows={productions.data.map((production) => ({
                        id: production.id,
                        cells: [
                            production.farm ? (
                                <Link
                                    key="farm"
                                    href={showFarm(production.farm.id)}
                                    className="font-medium hover:underline"
                                >
                                    {production.farm.farm_name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            production.farmer ? (
                                <Link
                                    key="farmer"
                                    href={showFarmer(production.farmer.id)}
                                    className="hover:underline"
                                >
                                    {production.farmer.name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            production.crop_label,
                            production.production_period || '—',
                            production.expected_label,
                            production.unit,
                            production.harvested_label,
                            production.exceeds ? (
                                <span
                                    key="remaining"
                                    className="text-destructive"
                                >
                                    {production.remaining_label}
                                </span>
                            ) : (
                                production.remaining_label
                            ),
                            <ProductionStatusBadge
                                key="status"
                                status={production.status}
                            />,
                            <div key="actions" className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={show(production.id)}>View</Link>
                                </Button>
                                {canRecord && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={edit(production.id)}>
                                            Edit
                                        </Link>
                                    </Button>
                                )}
                            </div>,
                        ],
                    }))}
                    emptyTitle={
                        hasFilters
                            ? 'No production records match these filters.'
                            : 'No production records yet.'
                    }
                    emptyDescription={
                        hasFilters
                            ? 'Try a different farm, crop, period, or status.'
                            : 'Add an expected quantity for a registered farm.'
                    }
                    emptyAction={
                        canRecord && !hasFilters ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add Production
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                {productions.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {productions.from}–{productions.to} of{' '}
                            {productions.total}
                        </p>
                        <div className="flex gap-2">
                            {productions.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={productions.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {productions.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={productions.next_page_url}>
                                        Next
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

ProductionIndex.layout = {
    breadcrumbs: [
        {
            title: 'Production',
            href: productionIndex(),
        },
    ],
};
