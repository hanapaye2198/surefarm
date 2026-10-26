import { formString } from '@/lib/form-data';
import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { index as financeIndex, show, transactions } from '@/routes/finance';

type Row = {
    id: number;
    financing_id: number;
    financing_reference: string;
    reference: string;
    type_label: string;
    component: string;
    amount: string;
    occurred_on: string;
    reconciliation: string;
};

type Paginated = {
    data: Row[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type Filters = {
    search: string;
    farmer: string;
    province: string;
    municipality: string;
    from: string;
    to: string;
};

type Option = { id: number; name: string };

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function FinanceTransactions({
    transactions: rows,
    filters,
    farmers,
    provinces,
    municipalities,
}: {
    transactions: Paginated;
    filters: Filters;
    farmers: Option[];
    provinces: string[];
    municipalities: string[];
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Finance', href: financeIndex() },
            { title: 'Ledger', href: transactions() },
        ],
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        router.get(
            transactions.url({
                query: {
                    search: formString(data, 'search'),
                    farmer: formString(data, 'farmer'),
                    province: formString(data, 'province'),
                    municipality: formString(data, 'municipality'),
                    from: formString(data, 'from'),
                    to: formString(data, 'to'),
                },
            }),
            {},
            { preserveState: true },
        );
    }

    return (
        <>
            <Head title="Financing ledger" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Financing ledger"
                    description="Posted disbursements, charges, payments, adjustments, and reversals. A reversal keeps the original row."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={financeIndex()}>Back to finance</Link>
                        </Button>
                    }
                />
                <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Input name="search" defaultValue={filters.search} placeholder="Reference" aria-label="Search transactions" />
                    <select name="farmer" defaultValue={filters.farmer} className={selectClassName} aria-label="Farmer">
                        <option value="">All farmers</option>
                        {farmers.map((farmer) => (
                            <option key={farmer.id} value={farmer.id}>{farmer.name}</option>
                        ))}
                    </select>
                    <select name="province" defaultValue={filters.province} className={selectClassName} aria-label="Province">
                        <option value="">All provinces</option>
                        {provinces.map((province) => (
                            <option key={province} value={province}>{province}</option>
                        ))}
                    </select>
                    <select name="municipality" defaultValue={filters.municipality} className={selectClassName} aria-label="Municipality">
                        <option value="">All municipalities</option>
                        {municipalities.map((municipality) => (
                            <option key={municipality} value={municipality}>{municipality}</option>
                        ))}
                    </select>
                    <Input name="from" type="date" defaultValue={filters.from} aria-label="From" />
                    <Input name="to" type="date" defaultValue={filters.to} aria-label="To" />
                    <div className="flex gap-2">
                        <Button type="submit">Apply filters</Button>
                        <Button variant="outline" asChild>
                            <Link href={transactions()}>Reset</Link>
                        </Button>
                    </div>
                </form>
                <DataTable
                    columns={['Date', 'Transaction', 'Agreement', 'Type', 'Component', 'Amount', 'Reconciliation', 'Actions']}
                    rows={rows.data.map((row) => ({
                        id: row.id,
                        href: show.url(row.financing_id),
                        cells: [
                            row.occurred_on,
                            row.reference,
                            row.financing_reference,
                            row.type_label,
                            row.component,
                            row.amount,
                            row.reconciliation,
                            <Button key="open" variant="outline" size="sm" asChild>
                                <Link href={show.url(row.financing_id)}>Open</Link>
                            </Button>,
                        ],
                    }))}
                    emptyTitle="No ledger transactions."
                    emptyDescription="Transactions appear after a financing agreement is disbursed or a payment is recorded."
                />
                {rows.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {rows.from}–{rows.to} of {rows.total}
                        </p>
                        <div className="flex gap-2">
                            {rows.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={rows.prev_page_url}>Previous</Link>
                                </Button>
                            )}
                            {rows.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={rows.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
