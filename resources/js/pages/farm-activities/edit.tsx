import { Head, Link } from '@inertiajs/react';
import { FarmActivityForm } from '@/components/farm-activity-form';
import type {
    ActivityFarmOption,
    ActivityOption,
    StatusOption,
} from '@/components/farm-activity-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { index as activitiesIndex, show } from '@/routes/farm-activities';

type EditableActivity = {
    id: number;
    activity_type_id: number;
    crop_type: string | null;
    activity_date_input: string | null;
    status: string;
    description: string | null;
    performed_by: string | null;
    quantity: number | null;
    unit: string | null;
    cost_amount: number | null;
    remarks: string | null;
};

function numberInput(value: number | null): string {
    if (value === null) {
        return '';
    }

    return String(value);
}

export default function EditFarmActivity({
    activity,
    farm,
    activityTypes,
    statuses,
}: {
    activity: EditableActivity;
    farm: ActivityFarmOption;
    activityTypes: ActivityOption[];
    statuses: StatusOption[];
}) {
    return (
        <>
            <Head title="Edit Activity" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Edit Activity"
                    description="Update the work record. The farm stays the one it was recorded on."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={show(activity.id)}>
                                Back to activity
                            </Link>
                        </Button>
                    }
                />
                <FarmActivityForm
                    mode="edit"
                    farm={farm}
                    activityId={activity.id}
                    activityTypes={activityTypes}
                    statuses={statuses}
                    initial={{
                        farm_id: String(farm.id),
                        activity_type_id: String(activity.activity_type_id),
                        crop_type: activity.crop_type ?? '',
                        activity_date: activity.activity_date_input ?? '',
                        status: activity.status,
                        description: activity.description ?? '',
                        performed_by: activity.performed_by ?? '',
                        quantity: numberInput(activity.quantity),
                        unit: activity.unit ?? '',
                        cost_amount: numberInput(activity.cost_amount),
                        remarks: activity.remarks ?? '',
                    }}
                />
            </div>
        </>
    );
}

EditFarmActivity.layout = {
    breadcrumbs: [
        {
            title: 'Farm Activities',
            href: activitiesIndex(),
        },
    ],
};
