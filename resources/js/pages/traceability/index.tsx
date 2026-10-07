import { formString } from '@/lib/form-data';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, QrCode } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { TraceabilityStatusBadge } from '@/components/status-badge';
import type { TraceabilityRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';
import { create, index, show } from '@/routes/traceability';

type Summary = {
    active_lots: number;
    green_bean_lots: number;
    completed_lots: number;
    traced_label: string;
    has_records: boolean;
};

type LotRow = {
    id: number;
    lot_code: string;
    quantity_label: string;
    unit: string;
    status: TraceabilityRecordStatus;
    stage: string | null;
    crop: string | null;
    harvest_date: string | null;
    farmer: { id: number; name: string } | null;
    farm: { id: number; farm_id: string; farm_name: string } | null;
};

type Paginated = {
    data: LotRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type Filters = {
    search: string;
    stage: string;
    status: string;
    crop: string;
    from: string;
    to: string;
};

type Option = { id: number; name: string };
type ValueOption = { value: string; label: string };

const countFormatter = new Intl.NumberFormat('en-US');

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function TraceabilityIndex({
    lots,
    summary,
    filters,
    stages,
    statuses,
    crops,
    can_manage,
}: {
    lots: Paginated;
    summary: Summary;
    filters: Filters;
    stages: Option[];
    statuses: ValueOption[];
    crops: ValueOption[];
    can_manage: boolean;
}) {
    const { auth } = usePage().props;
    const canManage =
        can_manage && userCanAccess(auth.user?.role, ['operations']);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        router.get(
            index.url({
                query: {
                    search: formString(data, 'search'),
                    stage: formString(data, 'stage'),
                    status: formString(data, 'status'),
                    crop: formString(data, 'crop'),
                    from: formString(data, 'from'),
                    to: formString(data, 'to'),
                },
            }),
        );
    }

    return (
        <>
            <Head title="Traceability" />
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Traceability"
                    description="Track coffee from farm origin through processing."
                    actions={
                        canManage ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Create lot
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Active Lots"
                        value={countFormatter.format(summary.active_lots)}
                        icon={QrCode}
                    />
                    <StatCard
                        label="Green Bean Lots"
                        value={countFormatter.format(summary.green_bean_lots)}
                        icon={QrCode}
                    />
                    <StatCard
                        label="Coffee Under Traceability"
                        value={summary.traced_label}
                        icon={QrCode}
                    />
                    <StatCard
                        label="Completed Lots"
                        value={countFormatter.format(summary.completed_lots)}
                        icon={QrCode}
                    />
                </div>

                <form
                    className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"
                    onSubmit={submit}
                >
                    <Input
                        name="search"
                        defaultValue={filters.search}
                        placeholder="Lot, farmer, or farm"
                        aria-label="Lot, farmer, or farm"
                    />
                    <select
                        name="stage"
                        defaultValue={filters.stage}
                        aria-label="Current stage"
                        className={selectClassName}
                    >
                        <option value="">All stages</option>
                        {stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                                {stage.name}
                            </option>
                        ))}
                    </select>
                    <select
                        name="status"
                        defaultValue={filters.status}
                        aria-label="Status"
                        className={selectClassName}
                    >
                        <option value="">All statuses</option>
                        {statuses.map((status) => (
                            <option key={status.value} value={status.value}>
                                {status.label}
                            </option>
                        ))}
                    </select>
                    <select
                        name="crop"
                        defaultValue={filters.crop}
                        aria-label="Crop"
                        className={selectClassName}
                    >
                        <option value="">All crops</option>
                        {crops.map((crop) => (
                            <option key={crop.value} value={crop.value}>
                                {crop.label}
                            </option>
                        ))}
                    </select>
                    <Input
                        name="from"
                        type="date"
                        defaultValue={filters.from}
                        aria-label="Harvest from"
                    />
                    <Input
                        name="to"
                        type="date"
                        defaultValue={filters.to}
                        aria-label="Harvest to"
                    />
                    <Button
                        type="submit"
                        variant="outline"
                        className="md:col-span-3 xl:col-span-6 xl:w-fit"
                    >
                        Filter
                    </Button>
                </form>

                <DataTable
                    columns={[
                        'Lot code',
                        'Farmer',
                        'Farm',
                        'Crop',
                        'Quantity',
                        'Unit',
                        'Current stage',
                        'Harvest date',
                        'Status',
                        'QR',
                        'Actions',
                    ]}
                    rows={lots.data.map((row) => ({
                        id: row.id,
                        cells: [
                            row.lot_code,
                            row.farmer ? (
                                <Link
                                    key="farmer"
                                    href={showFarmer(row.farmer.id)}
                                    className="font-medium hover:underline"
                                >
                                    {row.farmer.name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            row.farm ? (
                                <Link
                                    key="farm"
                                    href={showFarm(row.farm.id)}
                                    className="hover:underline"
                                >
                                    {row.farm.farm_name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            row.crop ?? '—',
                            row.quantity_label,
                            row.unit,
                            row.stage ?? '—',
                            row.harvest_date ?? '—',
                            <TraceabilityStatusBadge
                                key="status"
                                status={row.status}
                            />,
                            <Link
                                key="qr"
                                href={show(row.id)}
                                className="font-medium text-primary hover:underline"
                            >
                                View QR
                            </Link>,
                            <Link
                                key="view"
                                href={show(row.id)}
                                className="font-medium text-primary hover:underline"
                            >
                                View
                            </Link>,
                        ],
                    }))}
                    emptyTitle="No traceability lots yet."
                    emptyDescription="Create a lot from green bean inventory when coffee is ready to trace."
                    emptyAction={
                        canManage ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Create lot
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                {lots.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {lots.from}–{lots.to} of {lots.total}
                        </p>
                        <div className="flex gap-2">
                            {lots.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={lots.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {lots.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={lots.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
