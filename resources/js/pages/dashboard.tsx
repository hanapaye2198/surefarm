import { Head, Link } from '@inertiajs/react';
import {
    BadgeCheck,
    Clock,
    Leaf,
    ListChecks,
    MapPinned,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FarmLocationMap } from '@/components/farm-location-map';
import type { FarmLocation } from '@/components/farm-location-map';
import { VerifiedFarmLandMap } from '@/components/verified-farm-land-map';
import type { VerifiedFarmLand } from '@/components/verified-farm-land-map';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { InventoryStageBars } from '@/components/inventory-stage-bars';
import type { InventorySummary } from '@/components/inventory-stage-bars';
import { ProductionBalance } from '@/components/production-balance';
import { ActivityStatusBadge, HarvestStatusBadge, StatusBadge } from '@/components/status-badge';
import type { ActivityRecordStatus, FarmStatus, HarvestRecordStatus } from '@/components/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/routes';
import { index as activitiesIndex, show as showActivity } from '@/routes/farm-activities';
import { index as harvestIndex, show as showHarvest } from '@/routes/harvest';
import { index as inventoryIndex } from '@/routes/inventory';
import { index as traceabilityIndex, show as showLot } from '@/routes/traceability';

type DashboardSummary = {
    registered_farmers: number;
    registered_farms: number;
    total_coffee_farm_area_hectares: number;
    verified_farms: number;
    pending_verification: number;
    in_progress: number;
    needs_review: number;
    failed: number;
};

type AreaSummary = {
    total_declared_hectares: number;
    total_verified_hectares: number;
    coffee_hectares: number;
    other_crop_hectares: number;
};

const countFormatter = new Intl.NumberFormat('en-US');
const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const verificationRows: {
    status: FarmStatus;
    count: keyof DashboardSummary;
}[] = [
    { status: 'pending', count: 'pending_verification' },
    { status: 'in_progress', count: 'in_progress' },
    { status: 'verified', count: 'verified_farms' },
    { status: 'failed', count: 'failed' },
    { status: 'needs_review', count: 'needs_review' },
];

function hectares(value: number): string {
    return `${areaFormatter.format(value)} ha`;
}

type RecentActivity = {
    id: number;
    activity_date: string | null;
    farm_name: string;
    activity: string | null;
    status: ActivityRecordStatus;
};

type HarvestSummary = {
    expected_label: string;
    actual_label: string;
    remaining_label: string;
    exceeds: boolean;
    message: string | null;
    progress: number | null;
    has_records: boolean;
    harvesting_farms: number;
};

type RecentHarvest = {
    id: number;
    harvest_date: string | null;
    farmer_name: string;
    farm_name: string;
    crop_label: string;
    quantity_label: string;
    status: HarvestRecordStatus;
};

export default function Dashboard({
    summary,
    area_summary,
    locations,
    verified_lands,
    recent_activities,
    harvest_summary,
    recent_harvests,
    inventory_summary,
    traceability_summary,
    recent_lots,
}: {
    summary: DashboardSummary;
    area_summary: AreaSummary;
    locations: FarmLocation[];
    verified_lands: VerifiedFarmLand[];
    recent_activities: RecentActivity[];
    harvest_summary: HarvestSummary;
    recent_harvests: RecentHarvest[];
    inventory_summary: InventorySummary;
    traceability_summary: {
        active_lots: number;
        green_bean_lots: number;
        traced_label: string;
        has_records: boolean;
    };
    recent_lots: {
        id: number;
        lot_code: string;
        quantity_label: string;
        stage: string | null;
        status_label: string;
        farm: { farm_name: string } | null;
    }[];
}) {
    const kpis: {
        label: string;
        value: string;
        icon: LucideIcon;
    }[] = [
        {
            label: 'Registered Farmers',
            value: countFormatter.format(summary.registered_farmers),
            icon: Users,
        },
        {
            label: 'Registered Farms',
            value: countFormatter.format(summary.registered_farms),
            icon: MapPinned,
        },
        {
            label: 'Coffee Farm Area',
            value: hectares(summary.total_coffee_farm_area_hectares),
            icon: Leaf,
        },
        {
            label: 'Verified Farms',
            value: countFormatter.format(summary.verified_farms),
            icon: BadgeCheck,
        },
        {
            label: 'Pending Verification',
            value: countFormatter.format(summary.pending_verification),
            icon: Clock,
        },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Dashboard"
                    description="Operational overview of registered farmers, farms, and declared area."
                />

                <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-5 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2">
                    {kpis.map((kpi) => (
                        <StatCard
                            key={kpi.label}
                            label={kpi.label}
                            value={kpi.value}
                            icon={kpi.icon}
                        />
                    ))}
                </section>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Verified Farm Land</CardTitle>
                        <CardDescription>
                            Saved boundaries of active farms that have been
                            verified.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <VerifiedFarmLandMap lands={verified_lands} />
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Farm Locations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FarmLocationMap locations={locations} />
                    </CardContent>
                </Card>

                <section className="grid gap-4 lg:grid-cols-2">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Farm Verification</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="flex flex-col">
                                {verificationRows.map((row) => (
                                    <li
                                        key={row.status}
                                        className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
                                    >
                                        <StatusBadge status={row.status} />
                                        <span className="text-lg font-semibold tabular-nums">
                                            {countFormatter.format(
                                                summary[row.count],
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Farm Area Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="flex flex-col">
                                <div className="flex items-center justify-between gap-3 border-b py-3">
                                    <dt className="text-sm text-muted-foreground">
                                        Total Declared Farm Area
                                    </dt>
                                    <dd className="text-lg font-semibold tabular-nums">
                                        {hectares(
                                            area_summary.total_declared_hectares,
                                        )}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3 border-b py-3">
                                    <dt className="text-sm text-muted-foreground">
                                        Total Verified Farm Area
                                    </dt>
                                    <dd className="text-lg font-semibold tabular-nums">
                                        {hectares(
                                            area_summary.total_verified_hectares,
                                        )}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3 border-b py-3">
                                    <dt className="text-sm text-muted-foreground">
                                        Coffee Area
                                    </dt>
                                    <dd className="text-lg font-semibold tabular-nums">
                                        {hectares(area_summary.coffee_hectares)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3 py-3">
                                    <dt className="text-sm text-muted-foreground">
                                        Other Crop Area
                                    </dt>
                                    <dd className="text-lg font-semibold tabular-nums">
                                        {hectares(
                                            area_summary.other_crop_hectares,
                                        )}
                                    </dd>
                                </div>
                            </dl>
                            <p className="text-xs text-muted-foreground">
                                Declared area is the farmer&apos;s reported
                                area. Verified area sums farms whose status is
                                verified.
                            </p>
                        </CardContent>
                    </Card>
                </section>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Expected vs actual harvest</CardTitle>
                        <Link
                            href={harvestIndex()}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            View harvest
                        </Link>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Expected Harvest</p>
                                <p className="text-lg font-semibold tabular-nums">{harvest_summary.expected_label}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Actual Harvest</p>
                                <p className="text-lg font-semibold tabular-nums">{harvest_summary.actual_label}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Harvesting Farms</p>
                                <p className="text-lg font-semibold tabular-nums">
                                    {countFormatter.format(harvest_summary.harvesting_farms)}
                                </p>
                            </div>
                        </div>
                        {harvest_summary.has_records && (
                            <ProductionBalance
                                expected={harvest_summary.expected_label}
                                actual={harvest_summary.actual_label}
                                remaining={harvest_summary.remaining_label}
                                exceeds={harvest_summary.exceeds}
                                message={harvest_summary.message}
                                progress={harvest_summary.progress}
                            />
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Inventory by processing stage</CardTitle>
                        <Link
                            href={inventoryIndex()}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            View inventory
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {inventory_summary.has_records ? (
                            <InventoryStageBars summary={inventory_summary} />
                        ) : (
                            <p className="text-sm text-muted-foreground">No inventory records yet.</p>
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Traceability</CardTitle>
                        <Link href={traceabilityIndex()} className="text-sm font-medium text-primary hover:underline">
                            View traceability
                        </Link>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Active Lots</p>
                                <p className="text-lg font-semibold tabular-nums">{countFormatter.format(traceability_summary.active_lots)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Green Bean Lots</p>
                                <p className="text-lg font-semibold tabular-nums">{countFormatter.format(traceability_summary.green_bean_lots)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Traced Coffee</p>
                                <p className="text-lg font-semibold tabular-nums">{traceability_summary.traced_label}</p>
                            </div>
                        </div>
                        {recent_lots.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No traceability lots yet.</p>
                        ) : (
                            <ul className="grid gap-2">
                                {recent_lots.map((lot) => (
                                    <li key={lot.id}>
                                        <Link href={showLot(lot.id)} className="flex items-center justify-between gap-3 text-sm hover:underline">
                                            <span>{lot.lot_code}</span>
                                            <span className="text-muted-foreground">{lot.quantity_label} · {lot.stage ?? lot.status_label}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <section className="grid gap-4 lg:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Recent Farm Activities</CardTitle>
                        <Link
                            href={activitiesIndex()}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {recent_activities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <ListChecks className="size-5" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-base font-medium">
                                        No farm activities recorded yet.
                                    </h2>
                                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                                        Work recorded on a farm will appear
                                        here.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {recent_activities.map((activity) => (
                                    <li key={activity.id}>
                                        <Link
                                            href={showActivity(activity.id)}
                                            className="grid gap-1 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                                        >
                                            <span className="text-sm text-muted-foreground">
                                                {activity.activity_date}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">
                                                    {activity.farm_name}
                                                </span>
                                                <span className="block truncate text-sm text-muted-foreground">
                                                    {activity.activity}
                                                </span>
                                            </span>
                                            <ActivityStatusBadge
                                                status={activity.status}
                                            />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Recent Harvests</CardTitle>
                        <Link
                            href={harvestIndex()}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {recent_harvests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Leaf className="size-5" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-base font-medium">No harvest records yet.</h2>
                                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                                        Harvests recorded on a farm will appear here.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {recent_harvests.map((harvest) => (
                                    <li key={harvest.id}>
                                        <Link
                                            href={showHarvest(harvest.id)}
                                            className="grid gap-1 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                                        >
                                            <span className="text-sm text-muted-foreground">
                                                {harvest.harvest_date}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">
                                                    {harvest.farm_name}
                                                </span>
                                                <span className="block truncate text-sm text-muted-foreground">
                                                    {harvest.farmer_name} · {harvest.crop_label} · {harvest.quantity_label}
                                                </span>
                                            </span>
                                            <HarvestStatusBadge status={harvest.status} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
                </section>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
