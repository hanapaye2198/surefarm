import { Head, Link, setLayoutProps, usePage } from '@inertiajs/react';
import { Building2, Landmark, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { FarmCoverageList } from '@/components/farm-mm-data';
import { InventoryStageBars } from '@/components/inventory-stage-bars';
import type { InventorySummary } from '@/components/inventory-stage-bars';
import type { FarmCoverageFarm } from '@/components/farm-mm-data';
import { FarmerFarmPortfolio } from '@/components/farmer-farm-portfolio';
import type {
    FarmFilterOptions,
    PortfolioFarm,
} from '@/components/farmer-farm-portfolio';
import { ProductionBalance } from '@/components/production-balance';
import { RecentFarmActivities } from '@/components/recent-farm-activities';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { FarmerStatusBadge, StatusBadge } from '@/components/status-badge';
import type { FarmerRecordStatus } from '@/components/status-badge';
import type { RecentActivity } from '@/components/recent-farm-activities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { userCanAccess } from '@/lib/access';
import { cn } from '@/lib/utils';
import { index as activitiesIndex } from '@/routes/farm-activities';
import { index as farmersIndex, show, edit } from '@/routes/farmers';
import { index as inventoryIndex } from '@/routes/inventory';
import { index as traceabilityIndex } from '@/routes/traceability';

type Spouse = {
    first_name: string;
    middle_name: string | null;
    last_name: string;
    full_name: string;
};

type BankAccount = {
    bank_name: string;
    account_number: string;
    account_name: string;
    status: 'verified' | 'unverified';
    status_label: string;
};

type FarmerProfile = {
    id: number;
    farmer_id: string;
    full_name: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    date_of_birth: string | null;
    government_id: string | null;
    address: string;
    photo_url: string | null;
    purok_sitio: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
    mobile_number: string;
    email: string | null;
    status: FarmerRecordStatus;
    cooperative: string | null;
    member_since: string | null;
    registration_date: string | null;
    bank_account: BankAccount | null;
    spouse: Spouse | null;
    farms: PortfolioFarm[];
    farm_filters: FarmFilterOptions;
    farm_summary: {
        registered_farms: number;
        declared_area_hectares: number;
        total_verified_hectares: number;
        verified_farms: number;
        pending_verification: number;
        active_crops: number;
    };
    activity_count: number;
    recent_activities: RecentActivity[];
    production_summary: {
        expected_label: string;
        actual_label: string;
        remaining_label: string;
        exceeds: boolean;
        message: string | null;
        progress: number | null;
        has_records: boolean;
        harvesting_farms: number;
    };
    farm_coverage: FarmCoverageFarm[];
    inventory_summary: InventorySummary;
    traceability_summary: {
        active_lots: number;
        traced_label: string;
    };
};

const tabs = [
    'Profile',
    'Farms',
    'Financial Records',
    'Insurance',
    'Documents',
    'Activity History',
    'Verification History',
] as const;

type ProfileTab = (typeof tabs)[number];

const countFormatter = new Intl.NumberFormat('en-US');
const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function display(value: string | null): string {
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

function initials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

export default function FarmerProfilePage({
    farmer,
}: {
    farmer: FarmerProfile;
}) {
    const [tab, setTab] = useState<ProfileTab>('Profile');
    const { auth } = usePage().props;
    const canRegister = userCanAccess(auth.user?.role, ['operations']);

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Farmers',
                href: farmersIndex(),
            },
            {
                title: farmer.full_name,
                href: show(farmer.id),
            },
        ],
    });

    return (
        <>
            <Head title={farmer.full_name} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Farmer Profile"
                    description={farmer.full_name}
                    actions={
                        canRegister ? (
                            <Button asChild>
                                <Link href={edit(farmer.id)}>
                                    <Pencil />
                                    Edit farmer
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <Card className="shadow-none">
                    <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        {farmer.photo_url ? (
                            <img
                                src={farmer.photo_url}
                                alt={farmer.full_name}
                                className="size-24 rounded-xl object-cover"
                            />
                        ) : (
                            <div className="flex size-24 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
                                {initials(farmer.full_name)}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-semibold">
                                    {farmer.full_name}
                                </h2>
                                <FarmerStatusBadge status={farmer.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Farmer ID:{' '}
                                <span className="font-medium text-foreground">
                                    {farmer.farmer_id}
                                </span>
                            </p>
                            <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
                                <span className="inline-flex items-center gap-1.5">
                                    <Phone className="size-3.5" />
                                    {farmer.mobile_number}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Mail className="size-3.5" />
                                    {display(farmer.email)}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="size-3.5" />
                                    {display(
                                        [farmer.municipality, farmer.province]
                                            .filter(Boolean)
                                            .join(', '),
                                    )}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {farmer.cooperative ?? 'No cooperative recorded'}
                                {farmer.member_since
                                    ? ` · Member since ${farmer.member_since}`
                                    : ''}
                                {farmer.registration_date
                                    ? ` · Registered ${farmer.registration_date}`
                                    : ''}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                    <StatCard
                        label="Registered Farms"
                        value={countFormatter.format(
                            farmer.farm_summary.registered_farms,
                        )}
                    />
                    <StatCard
                        label="Total Declared Area"
                        value={`${areaFormatter.format(farmer.farm_summary.declared_area_hectares)} ha`}
                    />
                    <StatCard
                        label="Verified Farms"
                        value={countFormatter.format(
                            farmer.farm_summary.verified_farms,
                        )}
                    />
                    <StatCard
                        label="Pending Verification"
                        value={countFormatter.format(
                            farmer.farm_summary.pending_verification,
                        )}
                    />
                    <StatCard
                        label="Total Verified Area"
                        value={`${areaFormatter.format(farmer.farm_summary.total_verified_hectares)} ha`}
                    />
                    <StatCard
                        label="Active Crops"
                        value={countFormatter.format(
                            farmer.farm_summary.active_crops,
                        )}
                    />
                </section>

                <div className="flex gap-2 overflow-x-auto border-b">
                    {tabs.map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setTab(item)}
                            className={cn(
                                'shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
                                tab === item
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground',
                            )}
                        >
                            {item === 'Farms'
                                ? `Farms (${farmer.farms.length})`
                                : item}
                        </button>
                    ))}
                </div>

                {tab === 'Profile' && (
                    <>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Personal Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-4 sm:grid-cols-2">
                                    <Detail
                                        label="Full Name"
                                        value={farmer.full_name}
                                    />
                                    <Detail
                                        label="Date of Birth"
                                        value={display(farmer.date_of_birth)}
                                    />
                                    <div className="sm:col-span-2">
                                        <Detail
                                            label="Address"
                                            value={display(farmer.address)}
                                        />
                                    </div>
                                    <Detail
                                        label="Government ID"
                                        value={display(farmer.government_id)}
                                    />
                                    <Detail
                                        label="Contact No."
                                        value={farmer.mobile_number}
                                    />
                                    <Detail
                                        label="Email"
                                        value={display(farmer.email)}
                                    />
                                </dl>
                            </CardContent>
                        </Card>
                        <div className="grid content-start gap-4">
                            <Card className="shadow-none">
                                <CardHeader>
                                    <CardTitle>Bank Account</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {farmer.bank_account ? (
                                        <div className="grid gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                    <Landmark className="size-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">
                                                        {
                                                            farmer.bank_account
                                                                .bank_name
                                                        }
                                                    </p>
                                                    <p className="font-mono text-sm tracking-wide text-muted-foreground">
                                                        {
                                                            farmer.bank_account
                                                                .account_number
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <dl className="grid gap-4 sm:grid-cols-2">
                                                <Detail
                                                    label="Account Name"
                                                    value={
                                                        farmer.bank_account
                                                            .account_name
                                                    }
                                                />
                                                <div className="grid gap-1">
                                                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                        Status
                                                    </dt>
                                                    <dd>
                                                        {farmer.bank_account
                                                            .status ===
                                                        'verified' ? (
                                                            <StatusBadge status="verified" />
                                                        ) : (
                                                            <Badge
                                                                variant="secondary"
                                                                className="uppercase"
                                                            >
                                                                {
                                                                    farmer
                                                                        .bank_account
                                                                        .status_label
                                                                }
                                                            </Badge>
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            <p className="text-sm text-muted-foreground">
                                                No bank account linked yet.
                                            </p>
                                            {canRegister && (
                                                <Button
                                                    variant="outline"
                                                    className="w-fit"
                                                    asChild
                                                >
                                                    <Link href={edit(farmer.id)}>
                                                        Link bank account
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            <Card className="shadow-none">
                                <CardHeader>
                                    <CardTitle>Cooperative</CardTitle>
                                </CardHeader>
                                <CardContent className="flex items-start gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Building2 className="size-5" />
                                    </div>
                                    <div className="grid gap-1">
                                        <p className="text-sm font-semibold">
                                            {farmer.cooperative ??
                                                'No cooperative recorded'}
                                        </p>
                                        {farmer.member_since && (
                                            <p className="text-sm text-muted-foreground">
                                                Member since{' '}
                                                {farmer.member_since}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            {farmer.spouse && (
                                <Card className="shadow-none">
                                    <CardHeader>
                                        <CardTitle>Spouse</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Detail
                                            label="Full Name"
                                            value={farmer.spouse.full_name}
                                        />
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Farm summary</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {farmer.farms.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No farms registered yet.
                                </p>
                            ) : (
                                farmer.farms.slice(0, 3).map((farm) => (
                                    <div
                                        key={farm.id}
                                        className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">
                                                {farm.number_label} · {farm.farm_name}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {farm.crop_label} · {farm.declared_area} ·{' '}
                                                {farm.property_ownership_label}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <FarmerStatusBadge status={farm.status} />
                                            <StatusBadge status={farm.verification_status} />
                                        </div>
                                    </div>
                                ))
                            )}
                            {farmer.farms.length > 3 && (
                                <button
                                    type="button"
                                    onClick={() => setTab('Farms')}
                                    className="text-left text-sm font-medium text-primary"
                                >
                                    View all farms
                                </button>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Farm production</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Expected Production</p>
                                    <p className="text-lg font-semibold tabular-nums">
                                        {farmer.production_summary.expected_label}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Harvested</p>
                                    <p className="text-lg font-semibold tabular-nums">
                                        {farmer.production_summary.actual_label}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Harvesting Farms</p>
                                    <p className="text-lg font-semibold tabular-nums">
                                        {countFormatter.format(farmer.production_summary.harvesting_farms)}
                                    </p>
                                </div>
                            </div>
                            {farmer.production_summary.has_records && (
                                <ProductionBalance
                                    expected={farmer.production_summary.expected_label}
                                    actual={farmer.production_summary.actual_label}
                                    remaining={farmer.production_summary.remaining_label}
                                    exceeds={farmer.production_summary.exceeds}
                                    message={farmer.production_summary.message}
                                    progress={farmer.production_summary.progress}
                                />
                            )}
                        </CardContent>
                    </Card>
                    <Card className="shadow-none">
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>Inventory</CardTitle>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={inventoryIndex.url({ query: { farmer: farmer.id } })}>
                                    View inventory
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Total Coffee Inventory</p>
                                <p className="text-lg font-semibold tabular-nums">{farmer.inventory_summary.total_label}</p>
                            </div>
                            {farmer.inventory_summary.has_records ? (
                                <InventoryStageBars summary={farmer.inventory_summary} />
                            ) : (
                                <p className="text-sm text-muted-foreground">No inventory records yet.</p>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="shadow-none">
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>Traceability</CardTitle>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={traceabilityIndex.url({ query: { search: farmer.farmer_id } })}>
                                    View traceability
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-muted-foreground">Active Lots</p>
                                <p className="text-lg font-semibold tabular-nums">{countFormatter.format(farmer.traceability_summary.active_lots)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Traced Coffee</p>
                                <p className="text-lg font-semibold tabular-nums">{farmer.traceability_summary.traced_label}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <RecentFarmActivities
                        activities={farmer.recent_activities}
                        total={farmer.activity_count}
                        viewAllHref={activitiesIndex.url({
                            query: { farmer: farmer.id },
                        })}
                    />
                </>
                )}

                {tab === 'Farms' && (
                    <FarmerFarmPortfolio
                        farmerId={farmer.id}
                        farms={farmer.farms}
                        canRegister={canRegister}
                        filters={farmer.farm_filters}
                    />
                )}

                {tab === 'Financial Records' && (
                    <FarmCoverageList
                        farms={farmer.farm_coverage}
                        kind="financing"
                        canManage={canRegister}
                    />
                )}

                {tab === 'Insurance' && (
                    <FarmCoverageList
                        farms={farmer.farm_coverage}
                        kind="insurance"
                        canManage={canRegister}
                    />
                )}

                {tab === 'Documents' && (
                    <EmptyState
                        title="No documents yet."
                        description="Farmer documents will be listed here when that module is available."
                    />
                )}

                {tab === 'Activity History' && (
                    <RecentFarmActivities
                        activities={farmer.recent_activities}
                        total={farmer.activity_count}
                        viewAllHref={activitiesIndex.url({
                            query: { farmer: farmer.id },
                        })}
                    />
                )}

                {tab === 'Verification History' && (
                    <EmptyState
                        title="No verification history yet."
                        description="Open a farm to review its verification history. Farm status and verification status stay separate."
                    />
                )}

                <div>
                    <Button variant="outline" asChild>
                        <Link href={farmersIndex()}>Back to farmers</Link>
                    </Button>
                </div>
            </div>
        </>
    );
}

FarmerProfilePage.layout = {
    breadcrumbs: [
        {
            title: 'Farmers',
            href: farmersIndex(),
        },
    ],
};
