import { Head, Link } from '@inertiajs/react';
import { ProductionForm } from '@/components/production-form';
import type {
    ProductionFarmOption,
    StatusOption,
} from '@/components/production-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { index as productionIndex } from '@/routes/production';

export default function CreateProduction({
    farms,
    statuses,
    units,
    selectedFarmId,
    currentYear,
}: {
    farms: ProductionFarmOption[];
    statuses: StatusOption[];
    units: string[];
    selectedFarmId: number | null;
    currentYear: string;
}) {
    const farm = farms.find((item) => item.id === selectedFarmId);

    return (
        <>
            <Head title="Add Production" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Add Production"
                    description="Record the expected quantity for a farm. Harvest totals are kept separately."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={productionIndex()}>
                                Back to production
                            </Link>
                        </Button>
                    }
                />
                <ProductionForm
                    mode="create"
                    farms={farms}
                    statuses={statuses}
                    units={units}
                    initial={{
                        farm_id: selectedFarmId ? String(selectedFarmId) : '',
                        crop_type: farm?.crop_type ?? '',
                        production_period: currentYear,
                        expected_quantity: '',
                        unit: 'kg',
                        notes: '',
                        status: 'active',
                    }}
                />
            </div>
        </>
    );
}

CreateProduction.layout = {
    breadcrumbs: [
        {
            title: 'Production',
            href: productionIndex(),
        },
        {
            title: 'Add Production',
            href: productionIndex(),
        },
    ],
};
