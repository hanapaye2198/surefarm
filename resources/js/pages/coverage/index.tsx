import { Head, Link, setLayoutProps } from '@inertiajs/react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { index as financeIndex } from '@/routes/finance';
import { index as insuranceIndex } from '@/routes/insurance';
import { show as showFarm, index as farmsIndex } from '@/routes/farms';

type CoverageRow = {
    id: number;
    farm_record_id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    summary: string;
    detail: string;
};

type PaginatedRecords = {
    data: CoverageRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function CoverageIndex({
    kind,
    title,
    description,
    records,
    can_manage,
}: {
    kind: 'financing' | 'insurance';
    title: string;
    description: string;
    records: PaginatedRecords;
    can_manage: boolean;
}) {
    const tab = kind === 'insurance' ? 'insurance' : 'financing';
    const indexUrl = kind === 'insurance' ? insuranceIndex() : financeIndex();

    setLayoutProps({
        breadcrumbs: [
            {
                title,
                href: indexUrl,
            },
        ],
    });

    return (
        <>
            <Head title={title} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={title}
                    description={description}
                    actions={<Badge variant="outline">Partial</Badge>}
                />

                <p className="text-sm text-muted-foreground">
                    {can_manage
                        ? 'New records are added from the farm, using the form already on that record.'
                        : 'You can review records here. Adding or editing them is limited to operations.'}
                </p>

                <DataTable
                    columns={[
                        'Farm ID',
                        'Farm',
                        'Farmer',
                        'Record',
                        'Detail',
                        'Actions',
                    ]}
                    rows={records.data.map((record) => ({
                        id: record.id,
                        href: showFarm.url(record.farm_record_id, {
                            query: { tab },
                        }),
                        cells: [
                            <span key="id" className="font-medium">
                                {record.farm_id}
                            </span>,
                            record.farm_name,
                            record.farmer_name,
                            record.summary,
                            record.detail,
                            <Button
                                key="open"
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <Link
                                    href={showFarm.url(record.farm_record_id, {
                                        query: { tab },
                                    })}
                                >
                                    Open farm
                                </Link>
                            </Button>,
                        ],
                    }))}
                    emptyTitle={
                        kind === 'insurance'
                            ? 'No crop insurance records yet.'
                            : 'No financing records yet.'
                    }
                    emptyDescription="These records are stored on a farm. Open Farms & Map and choose a farm to add one."
                    emptyAction={
                        <Button variant="outline" asChild>
                            <Link href={farmsIndex()}>Open farms</Link>
                        </Button>
                    }
                />

                {records.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {records.from}–{records.to} of{' '}
                            {records.total}
                        </p>
                        <div className="flex gap-2">
                            {records.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={records.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {records.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={records.next_page_url}>
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
