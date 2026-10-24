import { Head, Link } from '@inertiajs/react';
import { FarmInsuranceForm } from '@/components/farm-insurance-form';
import type { InsuranceFarm } from '@/components/farm-insurance-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { show as showFarm } from '@/routes/farms';

export default function CreateFarmInsurance({ farm }: { farm: InsuranceFarm }) {
    return (
        <>
            <Head title="Add Crop Insurance" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Add Crop Insurance"
                    description="Record whether this farm is covered, and the peso amount and term when it is."
                    actions={
                        <Button variant="outline" asChild>
                            <Link
                                href={showFarm.url(farm.id, {
                                    query: { tab: 'insurance' },
                                })}
                            >
                                Back to farm
                            </Link>
                        </Button>
                    }
                />
                <FarmInsuranceForm mode="create" farm={farm} />
            </div>
        </>
    );
}
