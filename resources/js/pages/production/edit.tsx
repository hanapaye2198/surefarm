import { Head, Link } from '@inertiajs/react';
import { ProductionForm } from '@/components/production-form';
import type { StatusOption } from '@/components/production-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { index as productionIndex, show } from '@/routes/production';

type ProductionRecord = {
    id: number;
    production_period: string | null;
    expected_input: string;
    unit: string;
    notes: string | null;
    status: string;
    crop_type: string | null;
    farm: {
        id: number;
        farm_id: string;
        farm_name: string;
        crop_type: string;
        crop_label: string;
    } | null;
    farmer: { name: string } | null;
};

export default function EditProduction({
    production,
    statuses,
    units,
}: {
    production: ProductionRecord;
    statuses: StatusOption[];
    units: string[];
}) {
    return (
        <>
            <Head title="Edit Production" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Edit Production"
                    description="Update the estimate. Recorded harvests stay unchanged."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={show(production.id)}>Back to record</Link>
                        </Button>
                    }
                />
                <ProductionForm
                    mode="edit"
                    productionId={production.id}
                    farm={
                        production.farm
                            ? {
                                  id: production.farm.id,
                                  farm_id: production.farm.farm_id,
                                  farm_name: production.farm.farm_name,
                                  farmer_name: production.farmer?.name ?? '',
                                  crop_type: production.farm.crop_type,
                                  crop_label: production.farm.crop_label,
                              }
                            : undefined
                    }
                    statuses={statuses}
                    units={units}
                    initial={{
                        farm_id: production.farm ? String(production.farm.id) : '',
                        crop_type: production.crop_type ?? '',
                        production_period: production.production_period ?? '',
                        expected_quantity: production.expected_input,
                        unit: production.unit,
                        notes: production.notes ?? '',
                        status: production.status,
                    }}
                />
            </div>
        </>
    );
}

EditProduction.layout = {
    breadcrumbs: [
        {
            title: 'Production',
            href: productionIndex(),
        },
    ],
};
