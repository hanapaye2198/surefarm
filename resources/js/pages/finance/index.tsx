import { formString } from '@/lib/form-data';
import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    create,
    exportMethod,
    index as financeIndex,
    show,
    transactions as transactionsIndex,
} from '@/routes/finance';

type CurrencyTotal = {
    currency: string;
    disbursed: string;
    repayments: string;
    outstanding_principal: string;
    outstanding_interest: string;
    outstanding_fees: string;
    overdue: string;
    due_soon: string;
};

type Summary = {
    as_of_label: string;
    period_from: string | null;
    period_to: string | null;
    active_agreements: number;
    pending_applications: number;
    due_soon_count: number;
    overdue_count: number;
    snapshot_count: number;
    currencies: CurrencyTotal[];
    snapshots: {
        currency: string;
        stated_principal: string;
        stated_balance: string;
    }[];
    recent_transactions: {
        id: number;
        financing_id: number;
        financing_reference: string;
        reference: string;
        type_label: string;
        amount_label: string;
        occurred_on: string;
        reconciliation: string;
        reversed: boolean;
        farmer_name: string;
    }[];
    definitions: { metric: string; definition: string }[];
};

type FinancingRow = {
    id: number;
    reference: string;
    farmer_name: string;
    farm_name: string;
    farm_code: string;
    status_label: string;
    balance_source_label: string;
    type_label: string;
    principal: string;
    outstanding_principal: string;
    due_date: string;
};

type Paginated = {
    data: FinancingRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type Filters = {
    search: string;
    status: string;
    farmer: string;
    province: string;
    municipality: string;
    from: string;
    to: string;
    as_of: string;
    queue: string;
    sort: string;
    direction: string;
};

type Option = { id: number; name: string };
type StatusOption = { value: string; label: string };

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function FinanceIndex({
    summary,
    financings,
    filters,
    statuses,
    farmers,
    provinces,
    municipalities,
}: {
    summary: Summary;
    financings: Paginated;
    filters: Filters;
    statuses: StatusOption[];
    farmers: Option[];
    provinces: string[];
    municipalities: string[];
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Finance', href: financeIndex() }],
    });

    const period =
        summary.period_from || summary.period_to
            ? `${summary.period_from || 'Start'} to ${summary.period_to || summary.as_of_label}`
            : `All dates through ${summary.as_of_label}`;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        router.get(
            financeIndex.url({
                query: {
                    search: formString(data, 'search'),
                    status: formString(data, 'status'),
                    farmer: formString(data, 'farmer'),
                    province: formString(data, 'province'),
                    municipality: formString(data, 'municipality'),
                    from: formString(data, 'from'),
                    to: formString(data, 'to'),
                    as_of: formString(data, 'as_of'),
                    queue: filters.queue,
                    sort: filters.sort,
                    direction: filters.direction,
                },
            }),
            {},
            { preserveState: true },
        );
    }

    return (
        <>
            <Head title="Finance" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Finance"
                    description="Financing applications, disbursements, and repayments for farms in your registry scope. Balances come from the ledger. Stated farm grants are shown separately."
                    actions={
                        <>
                            <Button variant="outline" asChild>
                                <Link href={transactionsIndex()}>Ledger</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <a href={exportMethod.url({ query: filters })}>
                                    Export CSV
                                </a>
                            </Button>
                            <Button asChild>
                                <Link href={create()}>New application</Link>
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Active agreements"
                        value={summary.active_agreements}
                        detail={`Disbursed and not completed or defaulted as of ${summary.as_of_label}.`}
                    />
                    <StatCard
                        label="Pending applications"
                        value={summary.pending_applications}
                        detail="Submitted and not yet approved, rejected, or cancelled."
                        href={financeIndex.url({ query: { queue: 'review' } })}
                    />
                    <StatCard
                        label="Due soon"
                        value={summary.due_soon_count}
                        detail="Current agreements due within 14 days."
                        href={financeIndex.url({ query: { queue: 'due' } })}
                        tone="warning"
                    />
                    <StatCard
                        label="Overdue agreements"
                        value={summary.overdue_count}
                        detail={`Agreements past due with a balance as of ${summary.as_of_label}.`}
                        href={financeIndex.url({ query: { queue: 'overdue' } })}
                        tone="critical"
                    />
                </div>

                {summary.currencies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No ledger financing matches these filters. Totals stay
                        empty instead of using stated grant balances.
                    </p>
                ) : (
                    summary.currencies.map((currency) => (
                        <div key={currency.currency} className="grid gap-3">
                            <h2 className="text-sm font-medium">
                                {currency.currency} ledger · {period}
                            </h2>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <StatCard
                                    label="Disbursed"
                                    value={currency.disbursed}
                                    detail="Disbursement transactions in the period, excluding reversals effective by the balance date."
                                />
                                <StatCard
                                    label="Repayments received"
                                    value={currency.repayments}
                                    detail="Principal, interest, and fee payments in the period. Charges are not included."
                                />
                                <StatCard
                                    label="Outstanding principal"
                                    value={currency.outstanding_principal}
                                    detail="Principal still due. Interest and fees are not included."
                                />
                                <StatCard
                                    label="Overdue balance"
                                    value={currency.overdue}
                                    detail={`Principal, interest, and fees past due as of ${summary.as_of_label}.`}
                                    tone="critical"
                                />
                                <StatCard
                                    label="Outstanding interest"
                                    value={currency.outstanding_interest}
                                    detail="Unpaid stated interest. This is not principal."
                                />
                                <StatCard
                                    label="Outstanding fees"
                                    value={currency.outstanding_fees}
                                    detail="Unpaid fees. This is not principal."
                                />
                                <StatCard
                                    label="Due soon balance"
                                    value={currency.due_soon}
                                    detail="Total still due on agreements due within 14 days."
                                    tone="warning"
                                />
                            </div>
                        </div>
                    ))
                )}

                {summary.snapshot_count > 0 && (
                    <div className="rounded-xl border bg-card p-4 text-sm">
                        <p className="font-medium">
                            {summary.snapshot_count}{' '}
                            {summary.snapshot_count === 1
                                ? 'recorded grant'
                                : 'recorded grants'}{' '}
                            outside the ledger
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            These were entered on the farm with a stated amount
                            and stated balance. They are not counted as
                            disbursements or repayments.
                        </p>
                        <ul className="mt-3 grid gap-1">
                            {summary.snapshots.map((snapshot) => (
                                <li key={snapshot.currency}>
                                    {snapshot.currency}: stated principal{' '}
                                    {snapshot.stated_principal}, stated balance{' '}
                                    {snapshot.stated_balance}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <form
                    onSubmit={submit}
                    className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                    <Input
                        name="search"
                        defaultValue={filters.search}
                        placeholder="Reference, farmer, or farm"
                        aria-label="Search financing"
                    />
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
                        name="province"
                        defaultValue={filters.province}
                        className={selectClassName}
                        aria-label="Province"
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
                        defaultValue={filters.municipality}
                        className={selectClassName}
                        aria-label="Municipality"
                    >
                        <option value="">All municipalities</option>
                        {municipalities.map((municipality) => (
                            <option key={municipality} value={municipality}>
                                {municipality}
                            </option>
                        ))}
                    </select>
                    <Input
                        name="from"
                        type="date"
                        defaultValue={filters.from}
                        aria-label="Period from"
                    />
                    <Input
                        name="to"
                        type="date"
                        defaultValue={filters.to}
                        aria-label="Period to"
                    />
                    <Input
                        name="as_of"
                        type="date"
                        defaultValue={filters.as_of}
                        aria-label="Balance date"
                    />
                    <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
                        <Button type="submit">Apply filters</Button>
                        <Button variant="outline" asChild>
                            <Link href={financeIndex()}>Reset</Link>
                        </Button>
                    </div>
                </form>

                <div className="flex flex-wrap gap-2">
                    <QueueLink queue="" current={filters.queue} label="All" />
                    <QueueLink
                        queue="review"
                        current={filters.queue}
                        label="Review queue"
                    />
                    <QueueLink
                        queue="due"
                        current={filters.queue}
                        label="Due soon"
                    />
                    <QueueLink
                        queue="overdue"
                        current={filters.queue}
                        label="Overdue"
                    />
                </div>

                <DataTable
                    columns={[
                        'Reference',
                        'Farmer',
                        'Farm',
                        'Status',
                        'Principal',
                        'Outstanding principal',
                        'Due',
                        'Actions',
                    ]}
                    rows={financings.data.map((financing) => ({
                        id: financing.id,
                        href: show.url(financing.id),
                        cells: [
                            financing.reference,
                            financing.farmer_name,
                            financing.farm_name,
                            <span key="status" className="flex flex-col gap-1">
                                <span>{financing.status_label}</span>
                                <Badge variant="outline">
                                    {financing.balance_source_label}
                                </Badge>
                            </span>,
                            financing.principal,
                            financing.outstanding_principal,
                            financing.due_date,
                            <Button
                                key="open"
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <Link href={show.url(financing.id)}>Open</Link>
                            </Button>,
                        ],
                    }))}
                    emptyTitle="No financing records match these filters."
                    emptyDescription="Applications are created here. A stated grant can still be recorded from the farm, and it will appear with a stated balance."
                    emptyAction={
                        <Button asChild>
                            <Link href={create()}>New application</Link>
                        </Button>
                    }
                />

                {financings.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {financings.from}–{financings.to} of{' '}
                            {financings.total}
                        </p>
                        <div className="flex gap-2">
                            {financings.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={financings.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {financings.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={financings.next_page_url}>
                                        Next
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {summary.recent_transactions.length > 0 && (
                    <section className="grid gap-3">
                        <h2 className="text-sm font-medium">
                            Recent ledger transactions
                        </h2>
                        <DataTable
                            columns={[
                                'Date',
                                'Reference',
                                'Agreement',
                                'Farmer',
                                'Type',
                                'Amount',
                                'Status',
                            ]}
                            rows={summary.recent_transactions.map(
                                (transaction) => ({
                                    id: transaction.id,
                                    href: show.url(transaction.financing_id),
                                    cells: [
                                        transaction.occurred_on,
                                        transaction.reference,
                                        transaction.financing_reference,
                                        transaction.farmer_name,
                                        transaction.type_label,
                                        transaction.amount_label,
                                        transaction.reversed
                                            ? 'Reversed'
                                            : transaction.reconciliation,
                                    ],
                                }),
                            )}
                            emptyTitle="No transactions."
                            emptyDescription="Disbursements and payments appear here after they are posted."
                        />
                    </section>
                )}

                <section className="grid gap-3">
                    <h2 className="text-sm font-medium">Metric definitions</h2>
                    <dl className="grid gap-3">
                        {summary.definitions.map((definition) => (
                            <div key={definition.metric} className="grid gap-1">
                                <dt className="text-sm font-medium">
                                    {definition.metric}
                                </dt>
                                <dd className="text-sm text-muted-foreground">
                                    {definition.definition}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </div>
        </>
    );
}

function QueueLink({
    queue,
    current,
    label,
}: {
    queue: string;
    current: string;
    label: string;
}) {
    return (
        <Button
            variant={current === queue ? 'default' : 'outline'}
            size="sm"
            asChild
        >
            <Link
                href={financeIndex.url({
                    query: queue === '' ? {} : { queue },
                })}
            >
                {label}
            </Link>
        </Button>
    );
}
