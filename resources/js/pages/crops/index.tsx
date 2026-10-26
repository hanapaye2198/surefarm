import { formString } from '@/lib/form-data';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { ProductionStatusBadge } from '@/components/status-badge';
import type { ProductionRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import { create, edit, index as cropsIndex, show } from '@/routes/crops';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';

type CropRow = {
    id: number;
    crop_label: string;
    variety: string | null;
    area_label: string | null;
    planted_on_label: string | null;
    status: ProductionRecordStatus;
    farm: { id: number; farm_name: string } | null;
    farmer: { id: number; name: string } | null;
};

type Option = { value: string; label: string };
type FarmOption = { id: number; farm_name: string };
type FarmerOption = { id: number; name: string };

type Paginated = {
    data: CropRow[];
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
    status: string;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function CropsIndex({
    crops,
    filters,
    farms,
    farmers,
    cropTypes,
    statuses,
    can_record,
}: {
    crops: Paginated;
    filters: Filters;
    farms: FarmOption[];
    farmers: FarmerOption[];
    cropTypes: Option[];
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
            cropsIndex.url({
                query: {
                    search: formString(formData, 'search').trim(),
                    farm: formString(formData, 'farm'),
                    farmer: formString(formData, 'farmer'),
                    crop: formString(formData, 'crop'),
                    status: formString(formData, 'status'),
                },
            }),
            {},
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="Crop Management" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Crop Management"
                    description="Crop records for registered farms. Each record uses the crop already stored on the farm."
                    actions={
                        canRecord ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add crop record
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <form onSubmit={applyFilters} className="grid gap-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            name="search"
                            defaultValue={filters.search}
                            placeholder="Search variety, farmer, farmer reference, farm, or farm reference"
                            className="pl-9"
                        />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
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
                            {cropTypes.map((crop) => (
                                <option key={crop.value} value={crop.value}>
                                    {crop.label}
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
                                    <Link href={cropsIndex()}>Clear</Link>
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
                        'Variety',
                        'Planted area',
                        'Planted date',
                        'Status',
                        'Actions',
                    ]}
                    rows={crops.data.map((crop) => ({
                        id: crop.id,
                        href: show(crop.id),
                        cells: [
                            crop.farm ? (
                                <Link
                                    key="farm"
                                    href={showFarm(crop.farm.id)}
                                    className="font-medium hover:underline"
                                >
                                    {crop.farm.farm_name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            crop.farmer ? (
                                <Link
                                    key="farmer"
                                    href={showFarmer(crop.farmer.id)}
                                    className="hover:underline"
                                >
                                    {crop.farmer.name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            crop.crop_label,
                            display(crop.variety),
                            display(crop.area_label),
                            display(crop.planted_on_label),
                            <ProductionStatusBadge
                                key="status"
                                status={crop.status}
                            />,
                            <div key="actions" className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={show(crop.id)}>View</Link>
                                </Button>
                                {canRecord && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={edit(crop.id)}>Edit</Link>
                                    </Button>
                                )}
                            </div>,
                        ],
                    }))}
                    emptyTitle={
                        hasFilters
                            ? 'No crop records match these filters.'
                            : 'No crop records yet.'
                    }
                    emptyDescription={
                        hasFilters
                            ? 'Try a different farm, crop, or status.'
                            : 'Add a crop record for a registered farm.'
                    }
                    emptyAction={
                        canRecord && !hasFilters ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add crop record
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                {crops.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {crops.from}–{crops.to} of {crops.total}
                        </p>
                        <div className="flex gap-2">
                            {crops.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={crops.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {crops.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={crops.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

CropsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Crop Management',
            href: cropsIndex(),
        },
    ],
};
