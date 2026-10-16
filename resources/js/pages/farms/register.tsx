import { formString } from '@/lib/form-data';
import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { create as registerFarmer } from '@/routes/farmers';
import { create as createFarm } from '@/routes/farmers/farms';
import { index as farmsIndex, register as chooseFarmer } from '@/routes/farms';

type FarmerRow = {
    id: number;
    farmer_id: string;
    name: string;
    location: string;
    farms_count: number;
};

type PaginatedFarmers = {
    data: FarmerRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function RegisterFarm({
    farmers,
    filters,
}: {
    farmers: PaginatedFarmers;
    filters: { search: string };
}) {
    const hasSearch = filters.search.trim() !== '';

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Farms & Map',
                href: farmsIndex(),
            },
            {
                title: 'Register farm',
                href: chooseFarmer(),
            },
        ],
    });

    function searchFarmers(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const search = formString(new FormData(event.currentTarget), 'search');

        router.get(
            chooseFarmer.url({
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
            <Head title="Register farm" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Register farm"
                    description="Choose the farmer who owns the farm. The farm form stays tied to that farmer."
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
                        'Farms',
                        'Actions',
                    ]}
                    rows={farmers.data.map((farmer) => ({
                        id: farmer.id,
                        href: createFarm.url(farmer.id),
                        cells: [
                            <span key="id" className="font-medium">
                                {farmer.farmer_id}
                            </span>,
                            farmer.name,
                            farmer.location,
                            farmer.farms_count,
                            <Button
                                key="register"
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <Link href={createFarm.url(farmer.id)}>
                                    Register farm
                                </Link>
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
                            : 'Register a farmer first. A farm cannot be saved without one.'
                    }
                    emptyAction={
                        hasSearch ? null : (
                            <Button asChild>
                                <Link href={registerFarmer()}>
                                    Register farmer
                                </Link>
                            </Button>
                        )
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
