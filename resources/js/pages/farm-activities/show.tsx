import { Head, Link } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { ActivityStatusBadge } from '@/components/status-badge';
import type { ActivityRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { edit, index as activitiesIndex } from '@/routes/farm-activities';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';

type ActivityDetail = {
    id: number;
    activity_date_long: string | null;
    status: ActivityRecordStatus;
    description: string | null;
    performed_by: string | null;
    quantity_label: string;
    unit: string | null;
    cost: string;
    remarks: string | null;
    crop_label: string;
    activity_type: string | null;
    farm: {
        id: number;
        farm_id: string;
        farm_name: string;
    } | null;
    farmer: {
        id: number;
        name: string;
    } | null;
    created_by: string | null;
    created_at: string | null;
};

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="text-sm">{value}</dd>
        </div>
    );
}

export default function FarmActivityDetail({
    activity,
    can_edit,
}: {
    activity: ActivityDetail;
    can_edit: boolean;
}) {
    return (
        <>
            <Head title={activity.activity_type ?? 'Farm Activity'} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={activity.activity_type ?? 'Farm Activity'}
                    description="Farmer, farm, crop, and the work recorded on that farm."
                    actions={
                        can_edit ? (
                            <Button asChild>
                                <Link href={edit(activity.id)}>Edit</Link>
                            </Button>
                        ) : null
                    }
                />

                <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <li>
                        {activity.farmer ? (
                            <Link
                                href={showFarmer(activity.farmer.id)}
                                className="font-medium text-foreground hover:underline"
                            >
                                {activity.farmer.name}
                            </Link>
                        ) : (
                            'Farmer'
                        )}
                    </li>
                    <li aria-hidden="true">↓</li>
                    <li>
                        {activity.farm ? (
                            <Link
                                href={showFarm(activity.farm.id)}
                                className="font-medium text-foreground hover:underline"
                            >
                                {activity.farm.farm_name}
                            </Link>
                        ) : (
                            'Farm'
                        )}
                    </li>
                    <li aria-hidden="true">↓</li>
                    <li className="font-medium text-foreground">
                        {activity.crop_label}
                    </li>
                    <li aria-hidden="true">↓</li>
                    <li className="font-medium text-foreground">
                        {activity.activity_type}
                    </li>
                </ol>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Activity record</CardTitle>
                        <ActivityStatusBadge status={activity.status} />
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail
                                label="Activity Type"
                                value={display(activity.activity_type)}
                            />
                            <Detail
                                label="Date"
                                value={display(activity.activity_date_long)}
                            />
                            <Detail
                                label="Farm"
                                value={
                                    activity.farm
                                        ? `${activity.farm.farm_name} · ${activity.farm.farm_id}`
                                        : '—'
                                }
                            />
                            <Detail
                                label="Farmer"
                                value={display(activity.farmer?.name)}
                            />
                            <Detail label="Crop" value={activity.crop_label} />
                            <Detail
                                label="Performed By"
                                value={display(activity.performed_by)}
                            />
                            <Detail
                                label="Quantity"
                                value={activity.quantity_label}
                            />
                            <Detail label="Unit" value={display(activity.unit)} />
                            <Detail label="Cost" value={activity.cost} />
                            <Detail
                                label="Created By"
                                value={display(activity.created_by)}
                            />
                            <Detail
                                label="Created At"
                                value={display(activity.created_at)}
                            />
                            <div className="sm:col-span-2">
                                <Detail
                                    label="Description"
                                    value={display(activity.description)}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Detail
                                    label="Remarks"
                                    value={display(activity.remarks)}
                                />
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                <div>
                    <Button variant="outline" asChild>
                        <Link href={activitiesIndex()}>Back to activities</Link>
                    </Button>
                </div>
            </div>
        </>
    );
}

FarmActivityDetail.layout = {
    breadcrumbs: [
        {
            title: 'Farm Activities',
            href: activitiesIndex(),
        },
    ],
};
