import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    CircleCheck,
    Clock,
    Leaf,
    LockKeyhole,
    ListChecks,
    MapPinned,
    OctagonAlert,
    TriangleAlert,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { FarmLocationMap } from '@/components/farm-location-map';
import type { FarmLocation } from '@/components/farm-location-map';
import { VerifiedFarmLandMap } from '@/components/verified-farm-land-map';
import type { VerifiedFarmLand } from '@/components/verified-farm-land-map';
import { OpsNotice } from '@/components/ops-notice';
import type { NoticeTone } from '@/components/ops-notice';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { InventoryStageBars } from '@/components/inventory-stage-bars';
import type { InventorySummary } from '@/components/inventory-stage-bars';
import { ProductionBalance } from '@/components/production-balance';
import { WorkQueue } from '@/components/work-queue';
import type { WorkQueueItem } from '@/components/work-queue';
import {
    ActivityStatusBadge,
    HarvestStatusBadge,
    StatusBadge,
} from '@/components/status-badge';
import type {
    ActivityRecordStatus,
    FarmStatus,
    HarvestRecordStatus,
} from '@/components/status-badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import {
    index as verificationIndex,
    show as showVerification,
} from '@/routes/farm-verification';
import { index as farmsIndex, show as showFarm } from '@/routes/farms';
import {
    index as activitiesIndex,
    show as showActivity,
} from '@/routes/farm-activities';
import { index as harvestIndex, show as showHarvest } from '@/routes/harvest';
import { index as inventoryIndex } from '@/routes/inventory';
import {
    index as traceabilityIndex,
    show as showLot,
} from '@/routes/traceability';

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

function hectares(value: number): string {
    return `${areaFormatter.format(value)} ha`;
}

const verificationBar = {
    pending: 'bg-foreground/25',
    in_progress: 'bg-primary/70',
    verified: 'bg-primary',
    failed: 'bg-destructive',
    needs_review: 'bg-warning',
} as const;

function SectionCard({
    kicker,
    title,
    description,
    action,
    children,
    flush = false,
    className,
}: {
    kicker?: string;
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    flush?: boolean;
    className?: string;
}) {
    return (
        <Card
            className={cn(
                'gap-0 overflow-hidden rounded-lg py-0 shadow-none',
                className,
            )}
        >
            <CardHeader className="gap-1 border-b bg-muted/30 px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {kicker && (
                            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                {kicker}
                            </p>
                        )}
                        <CardTitle
                            className={cn('text-base', kicker && 'mt-1')}
                        >
                            {title}
                        </CardTitle>
                        {description && (
                            <CardDescription className="mt-1 text-pretty">
                                {description}
                            </CardDescription>
                        )}
                    </div>
                    {action}
                </div>
            </CardHeader>
            <CardContent className={flush ? 'p-0' : 'px-4 py-4 sm:px-5'}>
                {children}
            </CardContent>
        </Card>
    );
}

function MetricPlate({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 px-3 py-3 sm:px-4">
            <p className="text-[11px] leading-snug font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {label}
            </p>
            <p className="mt-1.5 text-base font-semibold tracking-tight break-words tabular-nums sm:text-lg">
                {value}
            </p>
        </div>
    );
}

function RegisterLink({
    href,
    children,
}: {
    href: ComponentProps<typeof Link>['href'];
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium tracking-[0.12em] text-primary uppercase hover:underline"
        >
            {children}
            <ArrowRight className="size-3" />
        </Link>
    );
}

function EmptyRegister({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">{title}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {description}
            </p>
        </div>
    );
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

type AssignedFarm = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string | null;
    location: string;
    verification_status: FarmStatus;
};

type FarmerProduction = {
    id: number;
    production_period: string | null;
    expected_label: string;
    status_label: string;
    farm: { farm_name: string } | null;
};

type FarmerNotice = {
    id: string;
    title: string;
    message: string;
    created_at: string | null;
    read: boolean;
};

type BoundaryRequest = {
    id: number;
    farm_id: number;
    farm_code: string | null;
    farm_name: string | null;
    farmer_name: string | null;
    reason: string | null;
    created_at: string | null;
};

function VerifierDashboard({
    summary,
    assignments,
    locations,
}: {
    summary: DashboardSummary;
    assignments: AssignedFarm[];
    locations: FarmLocation[];
}) {
    const next = assignments.filter((farm) =>
        ['pending', 'in_progress', 'needs_review'].includes(
            farm.verification_status,
        ),
    );

    return (
        <>
            <Head title="Field verifier dashboard" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Field verification"
                    description="These farms are assigned to your verifier account."
                    actions={
                        <Button asChild>
                            <Link href={verificationIndex()}>
                                Open verification queue
                            </Link>
                        </Button>
                    }
                />
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    <StatCard
                        label="Assigned"
                        value={countFormatter.format(summary.registered_farms)}
                    />
                    <StatCard
                        label="Pending"
                        value={countFormatter.format(
                            summary.pending_verification,
                        )}
                        tone={
                            summary.pending_verification > 0
                                ? 'warning'
                                : 'neutral'
                        }
                    />
                    <StatCard
                        label="In progress"
                        value={countFormatter.format(summary.in_progress)}
                        tone={summary.in_progress > 0 ? 'positive' : 'neutral'}
                    />
                    <StatCard
                        label="Needs review"
                        value={countFormatter.format(summary.needs_review)}
                        tone={summary.needs_review > 0 ? 'warning' : 'neutral'}
                    />
                    <StatCard
                        label="Verified"
                        value={countFormatter.format(summary.verified_farms)}
                        tone="positive"
                    />
                </section>
                <SectionCard
                    kicker="Queue"
                    title="Next farms"
                    description="Pending, in progress, and needs-review assignments."
                    flush={next.length > 0}
                >
                    {next.length === 0 ? (
                        <EmptyRegister
                            title="No farms waiting"
                            description="Assigned farms with an open verification status will appear here."
                        />
                    ) : (
                        <ul>
                            {next.map((farm) => (
                                <li
                                    key={farm.id}
                                    className="border-b last:border-b-0"
                                >
                                    <Link
                                        href={showVerification(farm.id)}
                                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50 sm:px-5"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">
                                                {farm.farm_name}
                                            </span>
                                            <span className="block truncate text-muted-foreground">
                                                {farm.farm_id}
                                                {farm.farmer_name
                                                    ? ` · ${farm.farmer_name}`
                                                    : ''}
                                                {farm.location
                                                    ? ` · ${farm.location}`
                                                    : ''}
                                            </span>
                                        </span>
                                        <StatusBadge
                                            status={farm.verification_status}
                                        />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
                <SectionCard kicker="Field" title="Assigned locations">
                    <FarmLocationMap locations={locations} />
                </SectionCard>
            </div>
        </>
    );
}

function FarmerDashboard({
    farmer,
    summary,
    activities,
    harvests,
    productions,
    notifications,
    photoStored,
}: {
    farmer?: { name: string; farmer_id: string };
    summary: DashboardSummary;
    activities: RecentActivity[];
    harvests: RecentHarvest[];
    productions: FarmerProduction[];
    notifications: FarmerNotice[];
    photoStored: boolean;
}) {
    const outstanding =
        summary.pending_verification +
        summary.in_progress +
        summary.needs_review;

    return (
        <>
            <Head title="Farmer dashboard" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={`Welcome, ${farmer?.name ?? 'farmer'}`}
                    description={`Your farms and their latest verification status${farmer?.farmer_id ? ` · ${farmer.farmer_id}` : ''}.`}
                />
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
                    <StatCard
                        label="My farms"
                        value={countFormatter.format(summary.registered_farms)}
                        icon={MapPinned}
                    />
                    <StatCard
                        label="Waiting on verification"
                        value={countFormatter.format(outstanding)}
                        icon={Clock}
                        tone={outstanding > 0 ? 'warning' : 'positive'}
                    />
                    <StatCard
                        label="Verified"
                        value={countFormatter.format(summary.verified_farms)}
                        icon={BadgeCheck}
                        tone="positive"
                    />
                </section>
                <SectionCard kicker="Status" title="What to check" flush>
                    <OpsNotice
                        bare
                        tone={outstanding > 0 ? 'warning' : 'success'}
                        icon={outstanding > 0 ? TriangleAlert : CircleCheck}
                        title={
                            outstanding === 0
                                ? 'Verification is current'
                                : 'Verification still open'
                        }
                        description={
                            outstanding === 0
                                ? 'None of your farms are pending, in progress, or marked needs review.'
                                : `${countFormatter.format(outstanding)} of your farms still have an open verification status.`
                        }
                    />
                    <OpsNotice
                        bare
                        className="border-t"
                        tone={photoStored ? 'success' : 'warning'}
                        icon={photoStored ? CircleCheck : TriangleAlert}
                        title={
                            photoStored
                                ? 'Profile photo on file'
                                : 'Profile photo missing'
                        }
                        description={
                            photoStored
                                ? 'A profile photo is stored on your farmer record.'
                                : 'No profile photo is stored on your farmer record.'
                        }
                    />
                    <OpsNotice
                        bare
                        className="border-t"
                        tone="info"
                        icon={LockKeyhole}
                        title="Insurance and financing"
                        description="Crop insurance and financing stay on the farm record. Your cooperative opens those forms."
                    />
                </SectionCard>
                <section className="grid gap-4 lg:grid-cols-2">
                    <SectionCard kicker="Field work" title="Recent activities">
                        {activities.length === 0 ? (
                            <EmptyRegister
                                title="No activities recorded"
                                description="Work recorded on your farms will appear in this register."
                            />
                        ) : (
                            <ul className="divide-y">
                                {activities.map((activity) => (
                                    <li
                                        key={activity.id}
                                        className="grid gap-1 py-3 text-sm"
                                    >
                                        <span className="font-medium">
                                            {activity.farm_name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {activity.activity_date ??
                                                'No date'}
                                            {activity.activity
                                                ? ` · ${activity.activity}`
                                                : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                    <SectionCard kicker="Yield" title="Recent harvests">
                        {harvests.length === 0 ? (
                            <EmptyRegister
                                title="No harvests recorded"
                                description="Harvests recorded on your farms will appear in this register."
                            />
                        ) : (
                            <ul className="divide-y">
                                {harvests.map((harvest) => (
                                    <li
                                        key={harvest.id}
                                        className="grid gap-1 py-3 text-sm"
                                    >
                                        <span className="font-medium">
                                            {harvest.farm_name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {harvest.quantity_label}
                                            {harvest.harvest_date
                                                ? ` · ${harvest.harvest_date}`
                                                : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                </section>
                <section className="grid gap-4 lg:grid-cols-2">
                    <SectionCard kicker="Planning" title="Production">
                        {productions.length === 0 ? (
                            <EmptyRegister
                                title="No production records"
                                description="Expected production stored for your farms will appear here."
                            />
                        ) : (
                            <ul className="divide-y">
                                {productions.map((production) => (
                                    <li
                                        key={production.id}
                                        className="grid gap-1 py-3 text-sm"
                                    >
                                        <span className="font-medium">
                                            {production.farm?.farm_name ??
                                                'Farm'}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {production.production_period ??
                                                'No period'}
                                            {' · '}
                                            {production.expected_label}
                                            {' · '}
                                            {production.status_label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                    <SectionCard kicker="Inbox" title="Updates" flush>
                        {notifications.length === 0 ? (
                            <div className="px-4 py-4 sm:px-5">
                                <EmptyRegister
                                    title="No notifications"
                                    description="Account updates will appear here."
                                />
                            </div>
                        ) : (
                            notifications.map((notice) => (
                                <OpsNotice
                                    key={notice.id}
                                    bare
                                    className="border-b last:border-b-0"
                                    tone={notice.read ? 'neutral' : 'info'}
                                    title={notice.title}
                                    description={notice.message}
                                    meta={notice.created_at}
                                />
                            ))
                        )}
                    </SectionCard>
                </section>
            </div>
        </>
    );
}

export default function Dashboard({
    mobile_dashboard_mode,
    summary,
    workspace,
    area_summary,
    locations,
    verified_lands,
    recent_activities,
    harvest_summary,
    recent_harvests,
    inventory_summary,
    traceability_summary,
    recent_lots,
    farmer,
    assigned_farms_preview,
    assigned_farms_map,
    recent_productions,
    recent_notifications,
    boundary_update_requests,
}: {
    mobile_dashboard_mode?: string;
    farmer?: { name: string; farmer_id: string; photo_url?: string | null };
    summary: DashboardSummary;
    workspace: {
        title: string;
        description: string;
        queues: WorkQueueItem[];
    };
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
    assigned_farms_preview?: AssignedFarm[];
    assigned_farms_map?: FarmLocation[];
    recent_productions?: FarmerProduction[];
    recent_notifications?: FarmerNotice[];
    boundary_update_requests?: BoundaryRequest[];
}) {
    if (mobile_dashboard_mode === 'farmer_account_not_linked') {
        return (
            <>
                <Head title="Farmer dashboard" />
                <div className="flex flex-col gap-5 sm:gap-6">
                    <PageHeader
                        title="Farmer dashboard"
                        description="Your SureFarm account is ready."
                    />
                    <div className="max-w-2xl">
                        <OpsNotice
                            tone="warning"
                            icon={LockKeyhole}
                            title="Finish setting up your farm access"
                            description="Your account is not linked to a farmer profile yet. Contact your cooperative or SureFarm administrator to connect your sign-in to your farmer record. Farm details will appear here after the link is made."
                        />
                    </div>
                </div>
            </>
        );
    }

    if (mobile_dashboard_mode === 'verifier_dashboard') {
        return (
            <VerifierDashboard
                summary={summary}
                assignments={assigned_farms_preview ?? []}
                locations={assigned_farms_map ?? []}
            />
        );
    }

    if (mobile_dashboard_mode === 'farmer_dashboard') {
        return (
            <FarmerDashboard
                farmer={farmer}
                summary={summary}
                activities={recent_activities}
                harvests={recent_harvests}
                productions={recent_productions ?? []}
                notifications={recent_notifications ?? []}
                photoStored={Boolean(farmer?.photo_url)}
            />
        );
    }

    const kpis: {
        label: string;
        value: string;
        icon: LucideIcon;
        href?: string;
        tone: 'neutral' | 'positive' | 'warning' | 'critical';
    }[] = [
        {
            label: 'Registered Farmers',
            value: countFormatter.format(summary.registered_farmers),
            icon: Users,
            tone: 'neutral',
        },
        {
            label: 'Registered Farms',
            value: countFormatter.format(summary.registered_farms),
            icon: MapPinned,
            tone: 'neutral',
        },
        {
            label: 'Coffee Farm Area',
            value: hectares(summary.total_coffee_farm_area_hectares),
            icon: Leaf,
            tone: 'positive',
        },
        {
            label: 'Verified Farms',
            value: countFormatter.format(summary.verified_farms),
            icon: BadgeCheck,
            tone: 'positive',
        },
        {
            label: 'Pending Verification',
            value: countFormatter.format(summary.pending_verification),
            icon: Clock,
            href: workspace.queues.find((queue) => queue.status === 'pending')
                ?.href,
            tone: summary.pending_verification > 0 ? 'warning' : 'neutral',
        },
    ];

    const boundaryRequests = boundary_update_requests ?? [];
    const openWarnings =
        summary.pending_verification +
        summary.needs_review +
        summary.failed +
        boundaryRequests.length;
    const verificationTotal = verificationRows.reduce(
        (total, row) => total + summary[row.count],
        0,
    );
    const declaredArea = area_summary.total_declared_hectares;
    const coffeeShare =
        declaredArea > 0
            ? Math.min(100, (area_summary.coffee_hectares / declaredArea) * 100)
            : 0;

    const attention: {
        key: string;
        tone: NoticeTone;
        icon: LucideIcon;
        title: string;
        description: string;
        href: string;
        action: string;
    }[] = [];

    if (summary.failed > 0) {
        attention.push({
            key: 'failed',
            tone: 'critical',
            icon: OctagonAlert,
            title: 'Failed verification',
            description:
                summary.failed === 1
                    ? '1 farm failed verification and needs a follow-up.'
                    : `${countFormatter.format(summary.failed)} farms failed verification and need a follow-up.`,
            href: farmsIndex.url({
                query: { verification_status: 'failed' },
            }),
            action: 'Open',
        });
    }

    if (summary.needs_review > 0) {
        attention.push({
            key: 'review',
            tone: 'warning',
            icon: TriangleAlert,
            title: 'Needs review',
            description: `${countFormatter.format(summary.needs_review)} ${summary.needs_review === 1 ? 'farm is' : 'farms are'} marked for review before verification can close.`,
            href: farmsIndex.url({
                query: { verification_status: 'needs_review' },
            }),
            action: 'Review',
        });
    }

    if (summary.pending_verification > 0) {
        attention.push({
            key: 'pending',
            tone: 'warning',
            icon: Clock,
            title: 'Pending verification',
            description: `${countFormatter.format(summary.pending_verification)} ${summary.pending_verification === 1 ? 'farm is' : 'farms are'} waiting to be verified.`,
            href: farmsIndex.url({
                query: { verification_status: 'pending' },
            }),
            action: 'Review',
        });
    }

    if (summary.in_progress > 0) {
        attention.push({
            key: 'progress',
            tone: 'info',
            icon: ListChecks,
            title: 'Verification in progress',
            description: `${countFormatter.format(summary.in_progress)} ${summary.in_progress === 1 ? 'farm is' : 'farms are'} currently being verified in the field.`,
            href: farmsIndex.url({
                query: { verification_status: 'in_progress' },
            }),
            action: 'Open',
        });
    }

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={workspace.title}
                    description={workspace.description}
                />

                <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-5 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2">
                    {kpis.map((kpi) => (
                        <StatCard
                            key={kpi.label}
                            label={kpi.label}
                            value={kpi.value}
                            icon={kpi.icon}
                            href={kpi.href}
                            tone={kpi.tone}
                        />
                    ))}
                </section>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Verification queue</CardTitle>
                        <CardDescription>
                            Current active farms. Declared area is unchanged
                            by these counts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WorkQueue items={workspace.queues} />
                    </CardContent>
                </Card>
                <SectionCard
                    kicker="Operations"
                    title="Needs attention"
                    description={
                        openWarnings === 0
                            ? summary.in_progress > 0
                                ? `${countFormatter.format(summary.in_progress)} ${summary.in_progress === 1 ? 'verification is' : 'verifications are'} in progress. Nothing else is waiting on a decision.`
                                : 'Verification, review, and boundary requests are current.'
                            : `${countFormatter.format(openWarnings)} open ${openWarnings === 1 ? 'item needs' : 'items need'} a decision${
                                  summary.in_progress > 0
                                      ? `. ${countFormatter.format(summary.in_progress)} ${summary.in_progress === 1 ? 'verification is' : 'verifications are'} in progress`
                                      : ''
                              }.`
                    }
                    action={
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={
                                    summary.pending_verification > 0
                                        ? farmsIndex.url({
                                              query: {
                                                  verification_status:
                                                      'pending',
                                              },
                                          })
                                        : farmsIndex()
                                }
                            >
                                {summary.pending_verification > 0
                                    ? 'Review pending'
                                    : 'Open farms'}
                            </Link>
                        </Button>
                    }
                    flush
                >
                    {attention.length === 0 && boundaryRequests.length === 0 ? (
                        <OpsNotice
                            bare
                            tone="success"
                            icon={CircleCheck}
                            title="No open warnings"
                            description="Failed checks, reviews, pending verification, and boundary updates are clear."
                        />
                    ) : (
                        <>
                            {attention.map((item) => (
                                <OpsNotice
                                    key={item.key}
                                    bare
                                    className="border-b last:border-b-0"
                                    tone={item.tone}
                                    icon={item.icon}
                                    title={item.title}
                                    description={item.description}
                                    action={
                                        <RegisterLink href={item.href}>
                                            {item.action}
                                        </RegisterLink>
                                    }
                                />
                            ))}
                            {boundaryRequests.map((request) => (
                                <OpsNotice
                                    key={request.id}
                                    bare
                                    className="border-b last:border-b-0"
                                    tone="warning"
                                    icon={MapPinned}
                                    title={`${request.farm_name ?? 'Farm'} boundary update`}
                                    description={
                                        request.reason ??
                                        `${request.farmer_name ?? 'A farmer'} requested a boundary change.`
                                    }
                                    meta={[
                                        request.farm_code,
                                        request.farmer_name,
                                        request.created_at,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    action={
                                        <RegisterLink
                                            href={showFarm(request.farm_id)}
                                        >
                                            Review
                                        </RegisterLink>
                                    }
                                />
                            ))}
                        </>
                    )}
                </SectionCard>

                <section className="grid gap-4 xl:grid-cols-2">
                    <SectionCard
                        kicker="Map"
                        title="Farm locations"
                        description="Recorded coordinates. This is separate from verified boundaries."
                    >
                        <FarmLocationMap locations={locations} />
                    </SectionCard>
                    <SectionCard
                        kicker="Map"
                        title="Verified farm land"
                        description="Saved boundaries of active farms that have been verified."
                    >
                        <VerifiedFarmLandMap lands={verified_lands} />
                    </SectionCard>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                    <SectionCard
                        kicker="Compliance"
                        title="Farm verification"
                        description={`${countFormatter.format(verificationTotal)} farms in the verification register.`}
                    >
                        <ul>
                            {verificationRows.map((row) => {
                                const count = summary[row.count];
                                const share =
                                    verificationTotal > 0
                                        ? (count / verificationTotal) * 100
                                        : 0;

                                return (
                                    <li
                                        key={row.status}
                                        className="border-b py-3 last:border-b-0"
                                    >
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <StatusBadge status={row.status} />
                                            <span className="text-lg font-semibold tabular-nums">
                                                {countFormatter.format(count)}
                                            </span>
                                        </div>
                                        <div className="h-1 overflow-hidden bg-muted">
                                            <div
                                                className={cn(
                                                    'h-full',
                                                    verificationBar[row.status],
                                                )}
                                                style={{ width: `${share}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </SectionCard>

                    <SectionCard kicker="Land" title="Farm area summary">
                        <dl>
                            {(
                                [
                                    [
                                        'Total declared',
                                        hectares(
                                            area_summary.total_declared_hectares,
                                        ),
                                    ],
                                    [
                                        'Total verified',
                                        hectares(
                                            area_summary.total_verified_hectares,
                                        ),
                                    ],
                                    [
                                        'Coffee',
                                        hectares(area_summary.coffee_hectares),
                                    ],
                                    [
                                        'Other crops',
                                        hectares(
                                            area_summary.other_crop_hectares,
                                        ),
                                    ],
                                ] as const
                            ).map(([label, value]) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
                                >
                                    <dt className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                        {label}
                                    </dt>
                                    <dd className="text-lg font-semibold tabular-nums">
                                        {value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <div className="mt-4">
                            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                <span>Coffee share</span>
                                <span className="tabular-nums">
                                    {Math.round(coffeeShare)}%
                                </span>
                            </div>
                            <div className="flex h-1.5 overflow-hidden bg-muted">
                                <div
                                    className="h-full bg-primary"
                                    style={{ width: `${coffeeShare}%` }}
                                />
                            </div>
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                            Declared area is the farmer&apos;s reported area.
                            Verified area sums farms whose status is verified.
                        </p>
                    </SectionCard>
                </section>

                <SectionCard
                    kicker="Yield"
                    title="Expected vs actual harvest"
                    action={
                        <RegisterLink href={harvestIndex()}>
                            View harvest
                        </RegisterLink>
                    }
                >
                    <div className="grid grid-cols-1 divide-y border bg-muted/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        <MetricPlate
                            label="Expected harvest"
                            value={harvest_summary.expected_label}
                        />
                        <MetricPlate
                            label="Actual harvest"
                            value={harvest_summary.actual_label}
                        />
                        <MetricPlate
                            label="Remaining"
                            value={harvest_summary.remaining_label}
                        />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        {countFormatter.format(
                            harvest_summary.harvesting_farms,
                        )}{' '}
                        {harvest_summary.harvesting_farms === 1
                            ? 'farm is'
                            : 'farms are'}{' '}
                        currently harvesting.
                    </p>
                    {harvest_summary.has_records &&
                        (harvest_summary.progress !== null ||
                            harvest_summary.exceeds) && (
                            <div className="mt-4">
                                <ProductionBalance
                                    expected={harvest_summary.expected_label}
                                    actual={harvest_summary.actual_label}
                                    remaining={
                                        harvest_summary.remaining_label
                                    }
                                    exceeds={harvest_summary.exceeds}
                                    message={harvest_summary.message}
                                    progress={harvest_summary.progress}
                                    showFigures={false}
                                />
                            </div>
                        )}
                    {!harvest_summary.has_records && (
                        <EmptyRegister
                            title="No harvest balance yet"
                            description="Expected and actual harvest will be compared here once records exist."
                        />
                    )}
                </SectionCard>

                <SectionCard
                    kicker="Stock"
                    title="Inventory by processing stage"
                    action={
                        <RegisterLink href={inventoryIndex()}>
                            View inventory
                        </RegisterLink>
                    }
                >
                    {inventory_summary.has_records ? (
                        <InventoryStageBars summary={inventory_summary} />
                    ) : (
                        <EmptyRegister
                            title="No inventory records"
                            description="Stock will appear here after coffee is received into a processing stage."
                        />
                    )}
                </SectionCard>
                <SectionCard
                    kicker="Lots"
                    title="Traceability"
                    action={
                        <RegisterLink href={traceabilityIndex()}>
                            View traceability
                        </RegisterLink>
                    }
                >
                    <div className="mb-4 grid grid-cols-1 divide-y border bg-muted/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        <MetricPlate
                            label="Active lots"
                            value={countFormatter.format(
                                traceability_summary.active_lots,
                            )}
                        />
                        <MetricPlate
                            label="Green bean lots"
                            value={countFormatter.format(
                                traceability_summary.green_bean_lots,
                            )}
                        />
                        <MetricPlate
                            label="Traced coffee"
                            value={traceability_summary.traced_label}
                        />
                    </div>
                    {recent_lots.length === 0 ? (
                        <EmptyRegister
                            title="No traceability lots"
                            description="Lot codes will appear here after coffee is traced from the farm."
                        />
                    ) : (
                        <ul className="border">
                            {recent_lots.map((lot) => (
                                <li
                                    key={lot.id}
                                    className="border-b last:border-b-0"
                                >
                                    <Link
                                        href={showLot(lot.id)}
                                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
                                    >
                                        <span className="font-medium">
                                            {lot.lot_code}
                                        </span>
                                        <span className="text-right text-muted-foreground">
                                            {lot.quantity_label} ·{' '}
                                            {lot.stage ?? lot.status_label}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>

                <section className="grid gap-4 lg:grid-cols-2">
                    <SectionCard
                        kicker="Field work"
                        title="Recent farm activities"
                        action={
                            <RegisterLink href={activitiesIndex()}>
                                View all
                            </RegisterLink>
                        }
                        flush={recent_activities.length > 0}
                    >
                        {recent_activities.length === 0 ? (
                            <EmptyRegister
                                title="No farm activities recorded"
                                description="Work recorded on a farm will appear in this register."
                            />
                        ) : (
                            <ul>
                                {recent_activities.map((activity) => (
                                    <li
                                        key={activity.id}
                                        className="border-b last:border-b-0"
                                    >
                                        <Link
                                            href={showActivity(activity.id)}
                                            className="grid gap-1 px-4 py-3 hover:bg-muted/50 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-5"
                                        >
                                            <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                                                {activity.activity_date ??
                                                    'No date'}
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
                    </SectionCard>
                    <SectionCard
                        kicker="Yield"
                        title="Recent harvests"
                        action={
                            <RegisterLink href={harvestIndex()}>
                                View all
                            </RegisterLink>
                        }
                        flush={recent_harvests.length > 0}
                    >
                        {recent_harvests.length === 0 ? (
                            <EmptyRegister
                                title="No harvest records"
                                description="Harvests recorded on a farm will appear in this register."
                            />
                        ) : (
                            <ul>
                                {recent_harvests.map((harvest) => (
                                    <li
                                        key={harvest.id}
                                        className="border-b last:border-b-0"
                                    >
                                        <Link
                                            href={showHarvest(harvest.id)}
                                            className="grid gap-1 px-4 py-3 hover:bg-muted/50 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-5"
                                        >
                                            <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                                                {harvest.harvest_date ??
                                                    'No date'}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">
                                                    {harvest.farm_name}
                                                </span>
                                                <span className="block truncate text-sm text-muted-foreground">
                                                    {harvest.farmer_name} ·{' '}
                                                    {harvest.crop_label} ·{' '}
                                                    {harvest.quantity_label}
                                                </span>
                                            </span>
                                            <HarvestStatusBadge
                                                status={harvest.status}
                                            />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
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
