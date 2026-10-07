import { formString } from '@/lib/form-data';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FarmerStatusBadge } from '@/components/status-badge';
import type { FarmerRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userCanAccess } from '@/lib/access';
import { create, index as farmersIndex, show } from '@/routes/farmers';

type FarmerRow = {
    id: number;
    farmer_id: string;
    name: string;
    location: string;
    cooperative: string | null;
    farms_count: number;
    status: FarmerRecordStatus;
};

type PaginatedFarmers = {
    data: FarmerRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

function display(value: string | null): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function FarmersIndex({
    farmers,
    filters,
}: {
    farmers: PaginatedFarmers;
    filters: { search: string };
}) {
    const { auth } = usePage().props;
    const canRegister = userCanAccess(auth.user?.role, ['operations']);
    const hasSearch = filters.search.trim() !== '';

    function searchFarmers(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const search = formString(new FormData(event.currentTarget), 'search');

        router.get(
            farmersIndex.url({
                query: {
                    search: search.trim(),
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
            <Head title="Farmers" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Farmers"
                    description="Manage farmer profiles and farm registrations."
                    actions={
                        canRegister ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Register Farmer
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <form
                    onSubmit={searchFarmers}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            name="search"
                            placeholder="Search farmer ID, name, or mobile number..."
                            aria-label="Search farmer ID, name, or mobile number"
                            defaultValue={filters.search}
                            className="pl-9"
                        />
                    </div>
                    <Button type="submit" variant="outline">
                        Search
                    </Button>
                </form>

                <DataTable
                    columns={[
                        'Farmer ID',
                        'Farmer',
                        'Location',
                        'Cooperative',
                        'Farms',
                        'Status',
                        'Actions',
                    ]}
                    rows={farmers.data.map((farmer) => ({
                        id: farmer.id,
                        cells: [
                            <span key="id" className="font-medium">
                                {farmer.farmer_id}
                            </span>,
                            farmer.name,
                            display(farmer.location),
                            display(farmer.cooperative),
                            farmer.farms_count,
                            <FarmerStatusBadge
                                key="status"
                                status={farmer.status}
                            />,
                            <Button
                                key="view"
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <Link href={show(farmer.id)}>View</Link>
                            </Button>,
                        ],
                    }))}
                    emptyTitle={
                        hasSearch
                            ? 'No farmers match your search.'
                            : 'No farmers registered yet.'
                    }
                    emptyDescription={
                        hasSearch
                            ? 'Try a different farmer ID, name, or mobile number.'
                            : 'Start by registering your first coffee farmer.'
                    }
                    emptyAction={
                        canRegister && !hasSearch ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Register Farmer
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                {farmers.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {farmers.from}–{farmers.to} of{' '}
                            {farmers.total}
                        </p>
                        <div className="flex gap-2">
                            {farmers.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={farmers.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {farmers.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={farmers.next_page_url}>
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

FarmersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Farmers',
            href: farmersIndex(),
        },
    ],
};
