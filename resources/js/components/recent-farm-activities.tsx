import { Link } from '@inertiajs/react';
import { ActivityStatusBadge } from '@/components/status-badge';
import type { ActivityRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { index as activitiesIndex, show } from '@/routes/farm-activities';

export type RecentActivity = {
    id: number;
    activity_date: string | null;
    farm_id: number;
    farm_name: string;
    activity: string | null;
    status: ActivityRecordStatus;
    status_label: string;
};

export function RecentFarmActivities({
    activities,
    total,
    viewAllHref,
}: {
    activities: RecentActivity[];
    total: number;
    viewAllHref: string;
}) {
    return (
        <Card className="shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                    <CardTitle>Recent Farm Activities</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        {total === 0
                            ? 'No farm activities recorded yet.'
                            : `${total} ${total === 1 ? 'activity' : 'activities'} across this farmer's farms.`}
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href={viewAllHref}>View All Activities</Link>
                </Button>
            </CardHeader>
            <CardContent>
                {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Activities stay on each farm. Record one from a farm
                        profile or the activity list.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="py-2 pr-3 font-medium">
                                        Date
                                    </th>
                                    <th className="py-2 pr-3 font-medium">
                                        Farm
                                    </th>
                                    <th className="py-2 pr-3 font-medium">
                                        Activity
                                    </th>
                                    <th className="py-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activities.map((activity) => (
                                    <tr
                                        key={activity.id}
                                        className="border-b last:border-0"
                                    >
                                        <td className="py-3 pr-3 whitespace-nowrap">
                                            {activity.activity_date}
                                        </td>
                                        <td className="py-3 pr-3">
                                            {activity.farm_name}
                                        </td>
                                        <td className="py-3 pr-3">
                                            <Link
                                                href={show(activity.id)}
                                                className="font-medium hover:underline"
                                            >
                                                {activity.activity}
                                            </Link>
                                        </td>
                                        <td className="py-3">
                                            <ActivityStatusBadge
                                                status={activity.status}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                    Showing the latest {Math.min(activities.length, 5)} of{' '}
                    {total}.{' '}
                    <Link
                        href={activitiesIndex()}
                        className="underline-offset-4 hover:underline"
                    >
                        Open the full activity list
                    </Link>
                    .
                </p>
            </CardContent>
        </Card>
    );
}
