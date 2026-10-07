import { Head, Link } from '@inertiajs/react';
import { HarvestForm } from '@/components/harvest-form';
import type { HarvestFarmOption, ProductionOption, StatusOption } from '@/components/harvest-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { index as harvestIndex } from '@/routes/harvest';

export default function CreateHarvest({
    farms,
    productions,
    statuses,
    units,
    selectedFarmId,
    selectedProductionId,
    today,
}: {
    farms: HarvestFarmOption[];
    productions: ProductionOption[];
    statuses: StatusOption[];
    units: string[];
    selectedFarmId: number | null;
    selectedProductionId: number | null;
    today: string;
}) {
    const farm = farms.find((item) => item.id === selectedFarmId);
    const production = productions.find((item) => item.id === selectedProductionId);

    return (
        <>
            <Head title="Record Harvest" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Record Harvest"
                    description="Save the quantity actually harvested. Expected production is left unchanged."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={harvestIndex()}>Back to harvest</Link>
                        </Button>
                    }
                />
                <HarvestForm
                    mode="create"
                    farms={farms}
                    productions={productions}
                    statuses={statuses}
                    units={units}
                    initial={{
                        farm_id: selectedFarmId ? String(selectedFarmId) : '',
                        crop_type: production?.crop_type ?? farm?.crop_type ?? '',
                        production_id: selectedProductionId ? String(selectedProductionId) : '',
                        harvest_date: today,
                        quantity: '',
                        unit: production?.unit ?? 'kg',
                        quality_grade: '',
                        status: 'completed',
                        notes: '',
                    }}
                />
            </div>
        </>
    );
}

CreateHarvest.layout = {
    breadcrumbs: [
        {
            title: 'Harvest',
            href: harvestIndex(),
        },
        {
            title: 'Record Harvest',
            href: harvestIndex(),
        },
    ],
};
