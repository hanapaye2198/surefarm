import { Head, Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import type { FarmStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { index, show } from '@/routes/farm-verification';

type FarmRow = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_label: string;
    declared_area: string;
    measured_area: string;
    variance: string;
    verification_status: FarmStatus;
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

type VerificationSummary = {
    pending: number;
    in_progress: number;
    verified: number;
    failed: number;
    needs_review: number;
};

const selectClassName =
    'border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const summaryRows: { status: FarmStatus; count: keyof VerificationSummary }[] =
    [
        { status: 'pending', count: 'pending' },
        { status: 'in_progress', count: 'in_progress' },
        { status: 'verified', count: 'verified' },
        { status: 'failed', count: 'failed' },
        { status: 'needs_review', count: 'needs_review' },
    ];

export default function FarmVerificationIndex({
    farms,
    filters,
    summary,
    verificationStatuses,
    crops,
    provinces,
    municipalities,
}: {
    farms: PaginatedFarms;
    filters: {
        search: string;
        verification_status: string;
        crop: string;
        province: string;
        municipality: string;
    };
    summary: VerificationSummary;
    verificationStatuses: Option[];
    crops: Option[];
    provinces: string[];
    municipalities: string[];
}) {
    const hasFilters =
        filters.search.trim() !== '' ||
        filters.verification_status !== '' ||
        filters.crop !== '' ||
        filters.province !== '' ||
        filters.municipality !== '';

    function searchFarms(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        router.get(
            index.url({
                query: {
                    search: String(formData.get('search') ?? '').trim(),
                    verification_status: String(
                        formData.get('verification_status') ?? '',
                    ),
                    crop: String(formData.get('crop') ?? ''),
                    province: String(formData.get('province') ?? ''),
                    municipality: String(formData.get('municipality') ?? ''),
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
            <Head title="Farm Verification" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Farm Verification"
                    description="Review farm boundaries, declared areas, and verification results."
                />

                <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
                    {summaryRows.map((row) => (
                        <StatCard
                            key={row.status}
                            label={<StatusBadge status={row.status} />}
                            value={summary[row.count]}
                        />
                    ))}
                </section>

                <form
                    onSubmit={searchFarms}
                    className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                >
                    <div className="relative sm:col-span-2 xl:col-span-3">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            name="search"
                            placeholder="Search farm ID, farm name, or farmer..."
                            aria-label="Search farm ID, farm name, or farmer"
                            defaultValue={filters.search}
                            className="pl-9"
                        />
                    </div>
                    <select
                        name="verification_status"
                        aria-label="Verification status"
                        defaultValue={filters.verification_status}
                        className={selectClassName}
                    >
                        <option value="">All verification</option>
                        {verificationStatuses.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <select
                        name="crop"
                        aria-label="Crop"
                        defaultValue={filters.crop}
                        className={selectClassName}
                    >
                        <option value="">All crops</option>
                        {crops.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <select
                        name="province"
                        aria-label="Province"
                        defaultValue={filters.province}
                        className={selectClassName}
                    >
                        <option value="">All provinces</option>
                        {provinces.map((province) => (
                            <option key={province} value={province}>
                                {province}
                            </option>
                        ))}
                    </select>
                    <select
                        name="municipality"
                        aria-label="Municipality"
                        defaultValue={filters.municipality}
                        className={selectClassName}
                    >
                        <option value="">All municipalities</option>
                        {municipalities.map((municipality) => (
                            <option key={municipality} value={municipality}>
                                {municipality}
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
                        'Measured Area',
                        'Variance',
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
                            farm.declared_area,
                            farm.measured_area,
                            farm.variance,
                            <StatusBadge
                                key="status"
                                status={farm.verification_status}
                            />,
                            <Button
                                key="review"
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <Link href={show(farm.id)}>Review</Link>
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
                            ? 'Try a different farm ID, name, farmer, crop, or location.'
                            : 'Registered farms will appear here for boundary review.'
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

FarmVerificationIndex.layout = {
    breadcrumbs: [
        {
            title: 'Farm Verification',
            href: index(),
        },
    ],
};
