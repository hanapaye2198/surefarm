import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import type { FarmStatus } from '@/components/status-badge';

export type VerificationHistoryRow = {
    id: number;
    date: string;
    reference: string;
    previous_status: FarmStatus | null;
    result: FarmStatus | null;
    declared_area: string;
    measured_area: string;
    difference: string;
    variance: string;
    verified_by: string | null;
    remarks: string | null;
};

export function FarmVerificationHistory({
    rows,
}: {
    rows: VerificationHistoryRow[];
}) {
    return (
        <DataTable
            columns={[
                'Date',
                'Reference',
                'Previous Status',
                'Result',
                'Declared Area',
                'Measured Area',
                'Difference',
                'Variance',
                'Verified By',
                'Remarks',
            ]}
            rows={rows.map((row) => ({
                id: row.id,
                cells: [
                    row.date,
                    row.reference,
                    row.previous_status ? (
                        <StatusBadge
                            key="previous"
                            status={row.previous_status}
                        />
                    ) : (
                        '—'
                    ),
                    row.result ? (
                        <StatusBadge key="result" status={row.result} />
                    ) : (
                        <StatusBadge key="result" status="in_progress" />
                    ),
                    row.declared_area,
                    row.measured_area,
                    row.difference,
                    row.variance,
                    row.verified_by ?? '—',
                    row.remarks ?? '—',
                ],
            }))}
            emptyTitle="No verification records yet."
            emptyDescription="A record is created when verification starts."
        />
    );
}
