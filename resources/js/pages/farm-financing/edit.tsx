import { Head, Link } from '@inertiajs/react';
import { FarmFinancingForm } from '@/components/farm-financing-form';
import type { FinancingFarm, FinancingTypeOption } from '@/components/farm-financing-form';
import type { FinancingRecord } from '@/components/farm-mm-data';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { show as showFarm } from '@/routes/farms';

export default function EditFarmFinancing({
    farm,
    financing,
    financingTypes,
}: {
    farm: FinancingFarm;
    financing: FinancingRecord;
    financingTypes: FinancingTypeOption[];
}) {
    return (
        <>
            <Head title="Edit Financing" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Edit Financing"
                    description="Update this financing record. It stays attached to the same farm."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={showFarm.url(farm.id, { query: { tab: 'financing' } })}>
                                Back to farm
                            </Link>
                        </Button>
                    }
                />
                <FarmFinancingForm
                    mode="edit"
                    farm={farm}
                    financingTypes={financingTypes}
                    financingId={financing.id}
                    values={{
                        amount: financing.amount,
                        date_granted: financing.date_granted_input,
                        loan_balance: financing.loan_balance,
                        financing_type: financing.financing_type,
                    }}
                />
            </div>
        </>
    );
}
