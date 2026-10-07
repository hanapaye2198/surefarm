import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { create as addFinancing } from '@/routes/farms/financing';
import { create as addInsurance } from '@/routes/farms/insurance';
import { show as showFarm } from '@/routes/farms';

export type InsuranceRecord = {
    id: number;
    covered: boolean;
    covered_label: string;
    amount_label: string;
    term_label: string;
    amount: string;
    term_months: string;
};

export type FinancingRecord = {
    id: number;
    amount_label: string;
    date_granted: string;
    date_granted_input: string;
    loan_balance_label: string;
    financing_type: string;
    financing_type_label: string;
    amount: string;
    loan_balance: string;
};

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="text-sm">{value}</dd>
        </div>
    );
}

export function CropInsuranceDetails({ record }: { record: InsuranceRecord }) {
    return (
        <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Covered" value={record.covered_label} />
            {record.covered && (
                <>
                    <Detail label="Amount" value={record.amount_label} />
                    <Detail label="Term" value={record.term_label} />
                </>
            )}
        </dl>
    );
}

export function FinancingDetails({ record }: { record: FinancingRecord }) {
    return (
        <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Amount" value={record.amount_label} />
            <Detail label="Date Granted" value={record.date_granted} />
            <Detail label="Loan Balance" value={record.loan_balance_label} />
            <Detail
                label="Financing Type"
                value={record.financing_type_label}
            />
        </dl>
    );
}

export type FarmCoverageFarm = {
    id: number;
    number_label: string;
    farm_id: string;
    farm_name: string;
    insurances: InsuranceRecord[];
    financings: FinancingRecord[];
};

export function FarmCoverageList({
    farms,
    kind,
    canManage,
}: {
    farms: FarmCoverageFarm[];
    kind: 'insurance' | 'financing';
    canManage: boolean;
}) {
    if (farms.length === 0) {
        return (
            <EmptyState
                title="No farms yet."
                description="Crop insurance and financing are recorded on each farm."
            />
        );
    }

    return (
        <div className="grid gap-4">
            {farms.map((farm) => {
                const records =
                    kind === 'insurance' ? farm.insurances : farm.financings;

                return (
                    <Card key={farm.id} className="shadow-none">
                        <CardHeader className="flex-row items-start justify-between gap-3">
                            <div className="grid gap-1">
                                <CardTitle>{farm.number_label}</CardTitle>
                                <CardDescription>
                                    {farm.farm_name} · {farm.farm_id}
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link
                                    href={showFarm.url(farm.id, {
                                        query: {
                                            tab:
                                                kind === 'insurance'
                                                    ? 'insurance'
                                                    : 'financing',
                                        },
                                    })}
                                >
                                    Open farm
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <p className="text-sm font-medium">
                                {kind === 'insurance'
                                    ? 'Crop Insurance'
                                    : 'Financing'}
                            </p>
                            {records.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {kind === 'insurance'
                                        ? 'No crop insurance recorded.'
                                        : 'No financing recorded.'}
                                </p>
                            ) : kind === 'insurance' ? (
                                farm.insurances.map((record) => (
                                    <CropInsuranceDetails
                                        key={record.id}
                                        record={record}
                                    />
                                ))
                            ) : (
                                farm.financings.map((record) => (
                                    <FinancingDetails
                                        key={record.id}
                                        record={record}
                                    />
                                ))
                            )}
                            {canManage && (
                                <div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={
                                                kind === 'insurance'
                                                    ? addInsurance(farm.id)
                                                    : addFinancing(farm.id)
                                            }
                                        >
                                            <Plus />
                                            {kind === 'insurance'
                                                ? 'Add crop insurance'
                                                : 'Add financing'}
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
