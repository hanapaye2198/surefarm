import { Link } from '@inertiajs/react';
import { InventoryStageBars } from '@/components/inventory-stage-bars';
import { ProductionBalance } from '@/components/production-balance';
import { ActivityStatusBadge } from '@/components/status-badge';
import type { ActivityRecordStatus } from '@/components/status-badge';
import { StatusBadge } from '@/components/status-badge';
import type { FarmStatus } from '@/components/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RegistryPayload } from '@/types/admin-dashboard';

const activityStatuses = new Set<ActivityRecordStatus>(['planned', 'in_progress', 'completed', 'cancelled']);
const farmStatuses = new Set<FarmStatus>(['pending', 'in_progress', 'verified', 'needs_review', 'failed']);

export function AdminRegistryOperations({
    registry,
    harvestHref,
    inventoryHref,
    activitiesHref,
}: {
    registry: RegistryPayload;
    harvestHref: string;
    inventoryHref: string;
    activitiesHref: string;
}) {
    const { harvest, inventory, activities, registrations } = registry.operations;

    return (
        <section id="operations" className="grid scroll-mt-24 gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Expected production and harvest</CardTitle>
                        <CardDescription>
                            Expected quantity stays on the production record. Actual harvest is completed harvest quantity in the same unit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {harvest.has_records ? (
                            <ProductionBalance
                                expected={harvest.expected_label}
                                actual={harvest.actual_label}
                                remaining={harvest.remaining_label}
                                exceeds={harvest.exceeds}
                                message={harvest.message}
                                progress={harvest.progress}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No production or harvest records in this registry yet.
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {harvest.harvesting_farms} {harvest.harvesting_farms === 1 ? 'farm is' : 'farms are'} currently harvesting.
                        </p>
                        <Link href={harvestHref} className="text-sm font-medium text-primary hover:underline">
                            Open harvest records
                        </Link>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Inventory by processing stage</CardTitle>
                        <CardDescription>
                            On-hand quantity at each stage. Input and output are not treated as the same amount.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {inventory.has_records ? (
                            <InventoryStageBars summary={inventory} />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No available inventory in this registry yet.
                            </p>
                        )}
                        <Link href={inventoryHref} className="text-sm font-medium text-primary hover:underline">
                            Open inventory
                        </Link>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent farm activities</CardTitle>
                        <CardDescription>Latest recorded work. Filters above do not change this list.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {activities.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No farm activities recorded.</p>
                        ) : (
                            <ul className="grid gap-2">
                                {activities.map((activity) => (
                                    <li key={activity.id}>
                                        <Link href={activity.href} className="grid gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center">
                                            <span className="text-xs text-muted-foreground">{activity.activity_date ?? 'No date'}</span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium">{activity.farm_name}</span>
                                                <span className="block truncate text-muted-foreground">{activity.activity ?? 'Activity'}</span>
                                            </span>
                                            {activityStatuses.has(activity.status as ActivityRecordStatus) ? (
                                                <ActivityStatusBadge status={activity.status as ActivityRecordStatus} />
                                            ) : (
                                                <span className="text-xs text-muted-foreground">{activity.status_label}</span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Link href={activitiesHref} className="text-sm font-medium text-primary hover:underline">
                            Open activities
                        </Link>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent farm registrations</CardTitle>
                        <CardDescription>Newest farm records in this registry.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {registrations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No farms have been registered.</p>
                        ) : (
                            <ul className="grid gap-2">
                                {registrations.map((farm) => (
                                    <li key={farm.id}>
                                        <Link href={farm.href} className="grid gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium">{farm.farm_name}</span>
                                                <span className="block truncate text-muted-foreground">
                                                    {farm.farmer_name} · {farm.farm_id} · {farm.registered_at ?? 'No date'}
                                                </span>
                                            </span>
                                            {farmStatuses.has(farm.verification_status as FarmStatus) ? (
                                                <StatusBadge status={farm.verification_status as FarmStatus} />
                                            ) : (
                                                <span className="text-xs text-muted-foreground">{farm.verification_label}</span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
