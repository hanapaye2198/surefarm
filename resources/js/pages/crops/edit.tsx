import { Head, Link } from '@inertiajs/react';
import { CropForm } from '@/components/crop-form';
import type { CropStatusOption } from '@/components/crop-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { index as cropsIndex, show } from '@/routes/crops';

type CropRecord = {
    id: number;
    crop_type: string;
    variety: string | null;
    area_input: string;
    planted_on: string | null;
    status: string;
    notes: string | null;
    farm: {
        id: number;
        farm_id: string;
        farm_name: string;
        crop_type: string;
        crop_label: string;
    } | null;
    farmer: { name: string } | null;
};

export default function EditCrop({
    crop,
    statuses,
}: {
    crop: CropRecord;
    statuses: CropStatusOption[];
}) {
    return (
        <>
            <Head title="Edit crop record" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Edit crop record"
                    description="Update the crop details. The record stays on the same farm."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={show(crop.id)}>Back to record</Link>
                        </Button>
                    }
                />
                <CropForm
                    mode="edit"
                    cropId={crop.id}
                    farm={
                        crop.farm
                            ? {
                                  id: crop.farm.id,
                                  farm_id: crop.farm.farm_id,
                                  farm_name: crop.farm.farm_name,
                                  farmer_name: crop.farmer?.name ?? '',
                                  crop_type: crop.farm.crop_type,
                                  crop_label: crop.farm.crop_label,
                              }
                            : undefined
                    }
                    statuses={statuses}
                    initial={{
                        farm_id: crop.farm ? String(crop.farm.id) : '',
                        crop_type: crop.crop_type,
                        variety: crop.variety ?? '',
                        area_hectares: crop.area_input,
                        planted_on: crop.planted_on ?? '',
                        status: crop.status,
                        notes: crop.notes ?? '',
                    }}
                />
            </div>
        </>
    );
}

EditCrop.layout = {
    breadcrumbs: [
        {
            title: 'Crop Management',
            href: cropsIndex(),
        },
    ],
};
