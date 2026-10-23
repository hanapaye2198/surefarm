import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { create, index as cooperativesIndex, show } from '@/routes/cooperatives';

type CooperativeRow = {
    id: number;
    name: string;
    code: string | null;
    status: string;
    status_label: string;
    active_members_count: number;
    suspended_members_count: number;
};

type Paginated = {
    data: CooperativeRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function CooperativesIndex({
    cooperatives,
    filters,
    can_manage,
}: {
    cooperatives: Paginated;
    filters: { search: string; status: string; sort: string; direction: string };
    can_manage: boolean;
}) {
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        router.get(
            cooperativesIndex.url({
                query: {
                    search: String(data.get('search') ?? ''),
                    status: String(data.get('status') ?? ''),
                    sort: String(data.get('sort') ?? 'name'),
                    direction: String(data.get('direction') ?? 'asc'),
                },
            }),
            {},
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="Cooperatives" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Cooperatives"
                    description="Register cooperatives and keep one current membership for each farmer."
                    actions={
                        can_manage ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Register cooperative
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Input name="search" defaultValue={filters.search} placeholder="Search name or code" />
                    <select name="status" defaultValue={filters.status} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <select name="sort" defaultValue={filters.sort} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
                        <option value="name">Name</option>
                        <option value="code">Code</option>
                        <option value="created_at">Registered</option>
                    </select>
                    <select name="direction" defaultValue={filters.direction} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                    <Button type="submit" variant="outline">Apply</Button>
                </form>

                <DataTable
                    columns={['Cooperative', 'Status', 'Active members', 'Suspended']}
                    rows={cooperatives.data.map((cooperative) => ({
                        id: cooperative.id,
                        cells: [
                            <Link key="name" href={show(cooperative.id)} className="font-medium hover:underline">
                                {cooperative.name}
                                {cooperative.code ? ` · ${cooperative.code}` : ''}
                            </Link>,
                            cooperative.status_label,
                            cooperative.active_members_count,
                            cooperative.suspended_members_count,
                        ],
                    }))}
                    emptyTitle="No cooperatives"
                    emptyDescription="Register a cooperative before attaching farmers to it."
                />

                {cooperatives.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {cooperatives.from}–{cooperatives.to} of {cooperatives.total}
                        </p>
                        <div className="flex gap-2">
                            {cooperatives.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={cooperatives.prev_page_url}>Previous</Link>
                                </Button>
                            )}
                            {cooperatives.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={cooperatives.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

CooperativesIndex.layout = {
    breadcrumbs: [{ title: 'Cooperatives', href: cooperativesIndex() }],
};
