import { Head, Link } from '@inertiajs/react';
import { HarvestForm } from '@/components/harvest-form';
import type { StatusOption } from '@/components/harvest-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { index as harvestIndex, show } from '@/routes/harvest';

type HarvestRecord = {
    id: number;
    harvest_date_input: string | null;
    quantity_input: string;
    unit: string;
    quality_grade: string | null;
    status: string;
    notes: string | null;
    crop_label: string;
    production_period: string | null;
    farm: {
        id: number;
        farm_id: string;
        farm_name: string;
        crop_type: string;
        crop_label: string;
    } | null;
    farmer: { name: string } | null;
};

export default function EditHarvest({
    harvest,
    statuses,
    units,
}: {
    harvest: HarvestRecord;
    statuses: StatusOption[];
    units: string[];
}) {
    const productionLabel = harvest.production_period
        ? `${harvest.production_period} · ${harvest.crop_label}`
        : null;

    return (
        <>
            <Head title="Edit Harvest" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Edit Harvest"
                    description="Correct this harvest. The original date it was recorded and who recorded it stay the same."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={show(harvest.id)}>Back to record</Link>
                        </Button>
                    }
                />
                <HarvestForm
                    mode="edit"
                    harvestId={harvest.id}
                    productionLabel={productionLabel}
                    farm={
                        harvest.farm
                            ? {
                                  id: harvest.farm.id,
                                  farm_id: harvest.farm.farm_id,
                                  farm_name: harvest.farm.farm_name,
                                  farmer_name: harvest.farmer?.name ?? '',
                                  crop_type: harvest.farm.crop_type,
                                  crop_label: harvest.farm.crop_label,
                              }
                            : undefined
                    }
                    statuses={statuses}
                    units={units}
                    initial={{
                        farm_id: harvest.farm ? String(harvest.farm.id) : '',
                        crop_type: '',
                        production_id: '',
                        harvest_date: harvest.harvest_date_input ?? '',
                        quantity: harvest.quantity_input,
                        unit: harvest.unit,
                        quality_grade: harvest.quality_grade ?? '',
                        status: harvest.status,
                        notes: harvest.notes ?? '',
                    }}
                />
            </div>
        </>
    );
}

EditHarvest.layout = {
    breadcrumbs: [
        {
            title: 'Harvest',
            href: harvestIndex(),
        },
    ],
};
