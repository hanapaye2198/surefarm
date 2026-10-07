import { Head, Link } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { FarmActivityForm } from '@/components/farm-activity-form';
import type {
    ActivityFarmOption,
    ActivityOption,
    StatusOption,
} from '@/components/farm-activity-form';
import { Button } from '@/components/ui/button';
import { index as activitiesIndex } from '@/routes/farm-activities';

export default function CreateFarmActivity({
    farms,
    activityTypes,
    statuses,
    selectedFarmId,
    today,
}: {
    farms: ActivityFarmOption[];
    activityTypes: ActivityOption[];
    statuses: StatusOption[];
    selectedFarmId: number | null;
    today: string;
}) {
    return (
        <>
            <Head title="Record Activity" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Record Activity"
                    description="Add operational work performed on one farm."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={activitiesIndex()}>
                                Back to activities
                            </Link>
                        </Button>
                    }
                />
                <FarmActivityForm
                    mode="create"
                    farms={farms}
                    activityTypes={activityTypes}
                    statuses={statuses}
                    initial={{
                        farm_id:
                            selectedFarmId === null
                                ? ''
                                : String(selectedFarmId),
                        activity_type_id: '',
                        crop_type: '',
                        activity_date: today,
                        status: 'completed',
                        description: '',
                        performed_by: '',
                        quantity: '',
                        unit: '',
                        cost_amount: '',
                        remarks: '',
                    }}
                />
            </div>
        </>
    );
}

CreateFarmActivity.layout = {
    breadcrumbs: [
        {
            title: 'Farm Activities',
            href: activitiesIndex(),
        },
        {
            title: 'Record Activity',
            href: activitiesIndex(),
        },
    ],
};
