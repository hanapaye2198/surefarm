import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { InventoryStageBars } from '@/components/inventory-stage-bars';
import type { InventorySummary } from '@/components/inventory-stage-bars';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { InventoryStatusBadge } from '@/components/status-badge';
import type { InventoryRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';
import { index as harvestIndex } from '@/routes/harvest';
import { index as inventoryIndex, processing, show } from '@/routes/inventory';

type InventoryRow = {
    id: number;
    received_date: string | null;
    quantity_label: string;
    unit: string;
    status: InventoryRecordStatus;
    location: string | null;
    stage: { name: string } | null;
    farmer: { id: number; name: string } | null;
    farm: { id: number; farm_name: string } | null;
    harvest: { label: string } | null;
};

type Option = { id: number; name: string };
type StatusOption = { value: string; label: string };

type Paginated = {
    data: InventoryRow[];
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
    stage: string;
    status: string;
    location: string;
    from: string;
    to: string;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function InventoryIndex({
    inventories,
    summary,
    filters,
    farms,
    farmers,
    stages,
    statuses,
    can_manage,
}: {
    inventories: Paginated;
    summary: InventorySummary;
    filters: Filters;
    farms: Option[];
    farmers: Option[];
    stages: Option[];
    statuses: StatusOption[];
    can_manage: boolean;
}) {
    const { auth } = usePage().props;
    const canManage = can_manage && userCanAccess(auth.user?.role, ['operations']);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        router.get(
            inventoryIndex.url({
                query: {
                    search: String(data.get('search') ?? ''),
                    farmer: String(data.get('farmer') ?? ''),
                    farm: String(data.get('farm') ?? ''),
                    stage: String(data.get('stage') ?? ''),
                    status: String(data.get('status') ?? ''),
                    location: String(data.get('location') ?? ''),
                    from: String(data.get('from') ?? ''),
                    to: String(data.get('to') ?? ''),
                },
            }),
            {},
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="Inventory" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Inventory"
                    description="Monitor coffee stocks by processing stage."
                    actions={
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button variant="outline" asChild>
                                <Link href={processing()}>Coffee processing</Link>
                            </Button>
                            {canManage && (
                                <Button asChild>
                                    <Link href={harvestIndex.url({ query: { status: 'completed', crop: 'coffee' } })}>
                                        <Plus />
                                        Receive harvest
                                    </Link>
                                </Button>
                            )}
                        </div>
                    }
                />

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <StatCard label="Total Coffee Inventory" value={summary.total_label} />
                    {summary.stages.map((stage) => (
                        <StatCard key={stage.id} label={stage.name} value={stage.label} />
                    ))}
                </section>

                <InventoryStageBars summary={summary} />

                <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="relative sm:col-span-2">
                        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
                        <Input name="search" defaultValue={filters.search} placeholder="Farmer, farm, or harvest" className="pl-9" />
                    </div>
                    <select name="farmer" defaultValue={filters.farmer} className={selectClassName} aria-label="Farmer">
                        <option value="">All farmers</option>
                        {farmers.map((farmer) => (
                            <option key={farmer.id} value={farmer.id}>{farmer.name}</option>
                        ))}
                    </select>
                    <select name="farm" defaultValue={filters.farm} className={selectClassName} aria-label="Farm">
                        <option value="">All farms</option>
                        {farms.map((farm) => (
                            <option key={farm.id} value={farm.id}>{farm.name}</option>
                        ))}
                    </select>
                    <select name="stage" defaultValue={filters.stage} className={selectClassName} aria-label="Processing stage">
                        <option value="">All stages</option>
                        {stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>{stage.name}</option>
                        ))}
                    </select>
                    <select name="status" defaultValue={filters.status} className={selectClassName} aria-label="Status">
                        <option value="">All statuses</option>
                        {statuses.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                    </select>
                    <Input name="location" defaultValue={filters.location} placeholder="Location" aria-label="Location" />
                    <Input name="from" type="date" defaultValue={filters.from} aria-label="From date" />
                    <Input name="to" type="date" defaultValue={filters.to} aria-label="To date" />
                    <Button type="submit" variant="outline">Filter</Button>
                </form>

                <DataTable
                    columns={['Date', 'Farmer', 'Farm', 'Harvest', 'Processing Stage', 'Quantity', 'Unit', 'Location', 'Status', 'Actions']}
                    rows={inventories.data.map((row) => ({
                        id: row.id,
                        cells: [
                            display(row.received_date),
                            row.farmer ? <Link key="farmer" href={showFarmer(row.farmer.id)} className="font-medium hover:underline">{row.farmer.name}</Link> : '—',
                            row.farm ? <Link key="farm" href={showFarm(row.farm.id)} className="hover:underline">{row.farm.farm_name}</Link> : '—',
                            row.harvest?.label ?? '—',
                            row.stage?.name ?? '—',
                            row.quantity_label,
                            row.unit,
                            display(row.location),
                            <InventoryStatusBadge key="status" status={row.status} />,
                            <Link key="view" href={show(row.id)} className="font-medium text-primary hover:underline">View</Link>,
                        ],
                    }))}
                    emptyTitle="No inventory records yet."
                    emptyDescription="Receive a completed coffee harvest to start the processing record."
                    emptyAction={
                        canManage ? (
                            <Button asChild>
                                <Link href={harvestIndex.url({ query: { status: 'completed', crop: 'coffee' } })}>
                                    <Plus />
                                    Receive harvest
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                {inventories.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {inventories.from}–{inventories.to} of {inventories.total}
                        </p>
                        <div className="flex gap-2">
                            {inventories.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={inventories.prev_page_url}>Previous</Link>
                                </Button>
                            )}
                            {inventories.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={inventories.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

InventoryIndex.layout = {
    breadcrumbs: [
        {
            title: 'Inventory',
            href: inventoryIndex(),
        },
    ],
};
