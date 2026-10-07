import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FarmerStatusBadge, StatusBadge } from '@/components/status-badge';
import type { FarmStatus, FarmerRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import { index as farmersIndex } from '@/routes/farmers';
import { index as farmsIndex, show } from '@/routes/farms';

type FarmRow = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_label: string;
    declared_area_hectares: number;
    location: string;
    verification_status: FarmStatus;
    status: FarmerRecordStatus;
};

type Option = {
    value: string;
    label: string;
};

type PaginatedFarms = {
    data: FarmRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function display(value: string | null): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function FarmsIndex({
    farms,
    filters,
    verificationStatuses,
    statuses,
}: {
    farms: PaginatedFarms;
    filters: {
        search: string;
        verification_status: string;
        status: string;
    };
    verificationStatuses: Option[];
    statuses: Option[];
}) {
    const { auth } = usePage().props;
    const canRegister = userCanAccess(auth.user?.role, ['operations']);
    const hasFilters =
        filters.search.trim() !== '' ||
        filters.verification_status !== '' ||
        filters.status !== '';

    function searchFarms(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        router.get(
            farmsIndex.url({
                query: {
                    search: String(formData.get('search') ?? '').trim(),
                    verification_status: String(
                        formData.get('verification_status') ?? '',
                    ),
                    status: String(formData.get('status') ?? ''),
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
            <Head title="Farms & Map" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Farms & Map"
                    description="Manage registered farms, locations, and verification status."
                    actions={
                        canRegister ? (
                            <Button asChild>
                                <Link href={farmersIndex()}>
                                    <Plus />
                                    Register Farm
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <form
                    onSubmit={searchFarms}
                    className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_10rem_auto] xl:items-center"
                >
                    <div className="relative sm:col-span-2 xl:col-span-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            name="search"
                            placeholder="Search farm ID, name, farmer, or crop..."
                            aria-label="Search farm ID, name, farmer, or crop"
                            defaultValue={filters.search}
                            className="pl-9"
                        />
                    </div>
                    <select
                        name="verification_status"
                        aria-label="Verification status"
                        defaultValue={filters.verification_status}
                        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <option value="">All verification</option>
                        {verificationStatuses.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <select
                        name="status"
                        aria-label="Farm status"
                        defaultValue={filters.status}
                        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <option value="">All statuses</option>
                        {statuses.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <Button type="submit" variant="outline">
                        Search
                    </Button>
                </form>

                <DataTable
                    columns={[
                        'Farm ID',
                        'Farm',
                        'Farmer',
                        'Crop',
                        'Declared Area',
                        'Location',
                        'Verification',
                        'Status',
                        'Actions',
                    ]}
                    rows={farms.data.map((farm) => ({
                        id: farm.id,
                        cells: [
                            <span key="id" className="font-medium">
                                {farm.farm_id}
                            </span>,
                            farm.farm_name,
                            farm.farmer_name,
                            farm.crop_label,
                            `${areaFormatter.format(farm.declared_area_hectares)} ha`,
                            display(farm.location),
                            <StatusBadge
                                key="verification"
                                status={farm.verification_status}
                            />,
                            <FarmerStatusBadge
                                key="status"
                                status={farm.status}
                            />,
                            <Button key="view" variant="outline" size="sm" asChild>
                                <Link href={show(farm.id)}>View</Link>
                            </Button>,
                        ],
                    }))}
                    emptyTitle={
                        hasFilters
                            ? 'No farms match your search.'
                            : 'No farms registered yet.'
                    }
                    emptyDescription={
                        hasFilters
                            ? 'Try a different farm ID, name, farmer, crop, or status.'
                            : 'Register a farm from a farmer profile.'
                    }
                    emptyAction={
                        hasFilters ? null : (
                            <Button variant="outline" asChild>
                                <Link href={farmersIndex()}>View farmers</Link>
                            </Button>
                        )
                    }
                />

                {farms.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {farms.from}–{farms.to} of {farms.total}
                        </p>
                        <div className="flex gap-2">
                            {farms.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={farms.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {farms.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={farms.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

FarmsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Farms & Map',
            href: farmsIndex(),
        },
    ],
};
