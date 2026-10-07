import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { ActivityStatusBadge } from '@/components/status-badge';
import type { ActivityRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import {
    create,
    index as activitiesIndex,
    show,
    edit,
} from '@/routes/farm-activities';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';

type ActivityRow = {
    id: number;
    activity_date: string | null;
    status: ActivityRecordStatus;
    performed_by: string | null;
    cost: string;
    crop_label: string;
    activity_type: string | null;
    farm: {
        id: number;
        farm_id: string;
        farm_name: string;
    } | null;
    farmer: {
        id: number;
        name: string;
    } | null;
};

type Option = {
    value: string;
    label: string;
};

type FarmOption = {
    id: number;
    farm_name: string;
    farm_id: string;
};

type FarmerOption = {
    id: number;
    name: string;
};

type ActivityTypeOption = {
    id: number;
    name: string;
};

type PaginatedActivities = {
    data: ActivityRow[];
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
    activity_type: string;
    status: string;
    from: string;
    to: string;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function FarmActivitiesIndex({
    activities,
    filters,
    farms,
    farmers,
    crops,
    activityTypes,
    statuses,
    can_record,
}: {
    activities: PaginatedActivities;
    filters: Filters;
    farms: FarmOption[];
    farmers: FarmerOption[];
    crops: Option[];
    activityTypes: ActivityTypeOption[];
    statuses: Option[];
    can_record: boolean;
}) {
    const { auth } = usePage().props;
    const canRecord =
        can_record && userCanAccess(auth.user?.role, ['operations']);
    const hasFilters = Object.values(filters).some((value) => value.trim() !== '');

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        router.get(
            activitiesIndex.url({
                query: {
                    search: String(formData.get('search') ?? '').trim(),
                    farm: String(formData.get('farm') ?? ''),
                    farmer: String(formData.get('farmer') ?? ''),
                    crop: String(formData.get('crop') ?? ''),
                    activity_type: String(formData.get('activity_type') ?? ''),
                    status: String(formData.get('status') ?? ''),
                    from: String(formData.get('from') ?? ''),
                    to: String(formData.get('to') ?? ''),
                },
            }),
            {},
            {
                preserveState: true,
                replace: true,
            },
        );
    }

    return (
        <>
            <Head title="Farm Activities" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Farm Activities"
                    description="Track activities performed across registered farms."
                    actions={
                        canRecord ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Record Activity
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
                            placeholder="Search farm ID, farm name, farmer, or activity type"
                            className="pl-9"
                        />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
                            name="activity_type"
                            defaultValue={filters.activity_type}
                            className={selectClassName}
                            aria-label="Activity type"
                        >
                            <option value="">All activity types</option>
                            {activityTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
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
                        <Input
                            type="date"
                            name="from"
                            defaultValue={filters.from}
                            aria-label="From date"
                        />
                        <Input
                            type="date"
                            name="to"
                            defaultValue={filters.to}
                            aria-label="To date"
                        />
                        <div className="flex gap-2">
                            <Button type="submit" variant="secondary">
                                Filter
                            </Button>
                            {hasFilters && (
                                <Button variant="outline" asChild>
                                    <Link href={activitiesIndex()}>Clear</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </form>

                <DataTable
                    columns={[
                        'Date',
                        'Farm',
                        'Farmer',
                        'Crop',
                        'Activity',
                        'Status',
                        'Performed By',
                        'Cost',
                        'Actions',
                    ]}
                    rows={activities.data.map((activity) => ({
                        id: activity.id,
                        cells: [
                            activity.activity_date,
                            activity.farm ? (
                                <Link
                                    key="farm"
                                    href={showFarm(activity.farm.id)}
                                    className="font-medium hover:underline"
                                >
                                    {activity.farm.farm_name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            activity.farmer ? (
                                <Link
                                    key="farmer"
                                    href={showFarmer(activity.farmer.id)}
                                    className="hover:underline"
                                >
                                    {activity.farmer.name}
                                </Link>
                            ) : (
                                '—'
                            ),
                            activity.crop_label,
                            <Link
                                key="activity"
                                href={show(activity.id)}
                                className="font-medium hover:underline"
                            >
                                {activity.activity_type}
                            </Link>,
                            <ActivityStatusBadge
                                key="status"
                                status={activity.status}
                            />,
                            display(activity.performed_by),
                            activity.cost,
                            <div key="actions" className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={show(activity.id)}>View</Link>
                                </Button>
                                {canRecord && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={edit(activity.id)}>
                                            Edit
                                        </Link>
                                    </Button>
                                )}
                            </div>,
                        ],
                    }))}
                    emptyTitle={
                        hasFilters
                            ? 'No activities match these filters.'
                            : 'No farm activities recorded yet.'
                    }
                    emptyDescription={
                        hasFilters
                            ? 'Try a different farm, crop, status, or date.'
                            : 'Record work performed on a registered farm.'
                    }
                    emptyAction={
                        canRecord && !hasFilters ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Record Activity
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                {activities.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {activities.from}–{activities.to} of{' '}
                            {activities.total}
                        </p>
                        <div className="flex gap-2">
                            {activities.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={activities.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {activities.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={activities.next_page_url}>
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

FarmActivitiesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Farm Activities',
            href: activitiesIndex(),
        },
    ],
};
