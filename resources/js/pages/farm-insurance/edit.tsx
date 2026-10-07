import { Head, Link } from '@inertiajs/react';
import { FarmInsuranceForm } from '@/components/farm-insurance-form';
import type { InsuranceFarm } from '@/components/farm-insurance-form';
import type { InsuranceRecord } from '@/components/farm-mm-data';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { show as showFarm } from '@/routes/farms';

export default function EditFarmInsurance({
    farm,
    insurance,
}: {
    farm: InsuranceFarm;
    insurance: InsuranceRecord;
}) {
    return (
        <>
            <Head title="Edit Crop Insurance" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Edit Crop Insurance"
                    description="Update the coverage for this farm. The farm record itself stays the same."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={showFarm.url(farm.id, { query: { tab: 'insurance' } })}>
                                Back to farm
                            </Link>
                        </Button>
                    }
                />
                <FarmInsuranceForm
                    mode="edit"
                    farm={farm}
                    insuranceId={insurance.id}
                    values={{
                        covered: insurance.covered ? '1' : '0',
                        amount: insurance.amount,
                        term_months: insurance.term_months,
                    }}
                />
            </div>
        </>
    );
}
