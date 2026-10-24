import { Head, Link } from '@inertiajs/react';
import { FarmFinancingForm } from '@/components/farm-financing-form';
import type {
    FinancingFarm,
    FinancingTypeOption,
} from '@/components/farm-financing-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { show as showFarm } from '@/routes/farms';

export default function CreateFarmFinancing({
    farm,
    financingTypes,
}: {
    farm: FinancingFarm;
    financingTypes: FinancingTypeOption[];
}) {
    return (
        <>
            <Head title="Add Financing" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Add Financing"
                    description="Record the peso amount, date granted, loan balance, and financing type for this farm."
                    actions={
                        <Button variant="outline" asChild>
                            <Link
                                href={showFarm.url(farm.id, {
                                    query: { tab: 'financing' },
                                })}
                            >
                                Back to farm
                            </Link>
                        </Button>
                    }
                />
                <FarmFinancingForm
                    mode="create"
                    farm={farm}
                    financingTypes={financingTypes}
                />
            </div>
        </>
    );
}
