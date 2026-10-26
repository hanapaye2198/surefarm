import { Head, Link } from '@inertiajs/react';
import { CropForm } from '@/components/crop-form';
import type {
    CropFarmOption,
    CropStatusOption,
} from '@/components/crop-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { index as cropsIndex } from '@/routes/crops';

export default function CreateCrop({
    farms,
    statuses,
    selectedFarmId,
}: {
    farms: CropFarmOption[];
    statuses: CropStatusOption[];
    selectedFarmId: number | null;
}) {
    const farm = farms.find((item) => item.id === selectedFarmId);

    return (
        <>
            <Head title="Add crop record" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Add crop record"
                    description="Record crop details for a registered farm. The crop must already belong to that farm."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={cropsIndex()}>
                                Back to crop management
                            </Link>
                        </Button>
                    }
                />
                <CropForm
                    mode="create"
                    farms={farms}
                    statuses={statuses}
                    initial={{
                        farm_id: selectedFarmId ? String(selectedFarmId) : '',
                        crop_type: farm?.crop_type ?? '',
                        variety: '',
                        area_hectares: '',
                        planted_on: '',
                        status: 'active',
                        notes: '',
                    }}
                />
            </div>
        </>
    );
}

CreateCrop.layout = {
    breadcrumbs: [
        {
            title: 'Crop Management',
            href: cropsIndex(),
        },
        {
            title: 'Add crop record',
            href: cropsIndex(),
        },
    ],
};
