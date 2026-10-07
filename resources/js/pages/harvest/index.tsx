import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search, Tractor, Wheat } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { HarvestStatusBadge } from '@/components/status-badge';
import type { HarvestRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';
import { create, edit, index as harvestIndex, show } from '@/routes/harvest';

type HarvestRow = {
    id: number;
    harvest_date: string | null;
    quantity_label: string;
    unit: string;
    quality_grade: string | null;
    status: HarvestRecordStatus;
    crop_label: string;
    farm: { id: number; farm_name: string } | null;
    farmer: { id: number; name: string } | null;
};

type Option = { value: string; label: string };
type FarmOption = { id: number; farm_name: string };
type FarmerOption = { id: number; name: string };

type Paginated = {
    data: HarvestRow[];
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
    quality: string;
    from: string;
    to: string;
};

type Summary = {
    total_harvest: string;
    harvesting_farms: number;
    completed_harvests: number;
    current_period: string;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const countFormatter = new Intl.NumberFormat('en-US');

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function HarvestIndex({
    harvests,
    summary,
    filters,
    farms,
    farmers,
    crops,
    statuses,
    can_record,
}: {
    harvests: Paginated;
    summary: Summary;
    filters: Filters;
    farms: FarmOption[];
    farmers: FarmerOption[];
    crops: Option[];
    statuses: Option[];
    can_record: boolean;
}) {
    const { auth } = usePage().props;
    const canRecord = can_record && userCanAccess(auth.user?.role, ['operations']);
    const hasFilters = Object.values(filters).some((value) => value.trim() !== '');

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        router.get(
            harvestIndex.url({
                query: {
                    search: String(formData.get('search') ?? '').trim(),
                    farm: String(formData.get('farm') ?? ''),
                    farmer: String(formData.get('farmer') ?? ''),
                    crop: String(formData.get('crop') ?? ''),
                    status: String(formData.get('status') ?? ''),
                    quality: String(formData.get('quality') ?? '').trim(),
                    from: String(formData.get('from') ?? ''),
                    to: String(formData.get('to') ?? ''),
                },
            }),
            {},
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="Harvest" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Harvest"
                    description="Record and monitor actual farm harvests."
                    actions={
                        canRecord ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Record Harvest
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    <StatCard label="Total Harvest" value={summary.total_harvest} icon={Wheat} />
                    <StatCard
                        label="Harvesting Farms"
                        value={countFormatter.format(summary.harvesting_farms)}
                        icon={Tractor}
                    />
                    <StatCard
                        label="Completed Harvests"
                        value={countFormatter.format(summary.completed_harvests)}
                    />
                    <StatCard label="Current Harvest Period" value={summary.current_period} />
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
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <select name="farmer" defaultValue={filters.farmer} className={selectClassName} aria-label="Farmer">
                            <option value="">All farmers</option>
                            {farmers.map((farmer) => (
                                <option key={farmer.id} value={farmer.id}>
                                    {farmer.name}
                                </option>
                            ))}
                        </select>
                        <select name="farm" defaultValue={filters.farm} className={selectClassName} aria-label="Farm">
                            <option value="">All farms</option>
                            {farms.map((farm) => (
                                <option key={farm.id} value={farm.id}>
                                    {farm.farm_name}
                                </option>
                            ))}
                        </select>
                        <select name="crop" defaultValue={filters.crop} className={selectClassName} aria-label="Crop">
                            <option value="">All crops</option>
                            {crops.map((crop) => (
                                <option key={crop.value} value={crop.value}>
                                    {crop.label}
                                </option>
                            ))}
                        </select>
                        <select name="status" defaultValue={filters.status} className={selectClassName} aria-label="Status">
                            <option value="">All statuses</option>
                            {statuses.map((status) => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                        <Input name="quality" defaultValue={filters.quality} placeholder="Quality grade" aria-label="Quality grade" />
                        <Input type="date" name="from" defaultValue={filters.from} aria-label="From date" />
                        <Input type="date" name="to" defaultValue={filters.to} aria-label="To date" />
                        <div className="flex gap-2">
                            <Button type="submit" variant="secondary">
                                Filter
                            </Button>
                            {hasFilters && (
                                <Button variant="outline" asChild>
                                    <Link href={harvestIndex()}>Clear</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </form>

                <DataTable
                    columns={['Harvest Date', 'Farm', 'Farmer', 'Crop', 'Quantity', 'Unit', 'Quality', 'Status', 'Actions']}
                    rows={harvests.data.map((harvest) => ({
                        id: harvest.id,
                        cells: [
                            harvest.harvest_date,
                            harvest.farm ? (
                                <Link key="farm" href={showFarm(harvest.farm.id)} className="font-medium hover:underline">
                                    {harvest.farm.farm_name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            harvest.farmer ? (
                                <Link key="farmer" href={showFarmer(harvest.farmer.id)} className="hover:underline">
                                    {harvest.farmer.name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            harvest.crop_label,
                            harvest.quantity_label,
                            harvest.unit,
                            display(harvest.quality_grade),
                            <HarvestStatusBadge key="status" status={harvest.status} />,
                            <div key="actions" className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={show(harvest.id)}>View</Link>
                                </Button>
                                {canRecord && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={edit(harvest.id)}>Edit</Link>
                                    </Button>
                                )}
                            </div>,
                        ],
                    }))}
                    emptyTitle={hasFilters ? 'No harvest records match these filters.' : 'No harvest records yet.'}
                    emptyDescription={
                        hasFilters
                            ? 'Try a different farm, status, quality, or date.'
                            : 'Record the quantity actually harvested on a farm.'
                    }
                    emptyAction={
                        canRecord && !hasFilters ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Record Harvest
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                {harvests.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {harvests.from}–{harvests.to} of {harvests.total}
                        </p>
                        <div className="flex gap-2">
                            {harvests.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={harvests.prev_page_url}>Previous</Link>
                                </Button>
                            )}
                            {harvests.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={harvests.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

HarvestIndex.layout = {
    breadcrumbs: [
        {
            title: 'Harvest',
            href: harvestIndex(),
        },
    ],
};
