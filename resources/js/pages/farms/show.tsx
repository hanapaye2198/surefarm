import { Head, Link, setLayoutProps } from '@inertiajs/react';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import {
    CropInsuranceDetails,
    FinancingDetails,
} from '@/components/farm-mm-data';
import type {
    FinancingRecord,
    InsuranceRecord,
} from '@/components/farm-mm-data';
import { FarmBoundaryMap } from '@/components/farm-boundary-map';
import type { BoundaryGeoJson } from '@/components/farm-boundary-map';
import { InventoryStageBars } from '@/components/inventory-stage-bars';
import type { InventorySummary } from '@/components/inventory-stage-bars';
import { FarmVerificationHistory } from '@/components/farm-verification-history';
import type { VerificationHistoryRow } from '@/components/farm-verification-history';
import { PageHeader } from '@/components/page-header';
import { ProductionBalance } from '@/components/production-balance';
import { StatCard } from '@/components/stat-card';
import {
    ActivityStatusBadge,
    FarmerStatusBadge,
    HarvestStatusBadge,
    ProductionStatusBadge,
    StatusBadge,
    TraceabilityStatusBadge,
} from '@/components/status-badge';
import type {
    ActivityRecordStatus,
    FarmStatus,
    FarmerRecordStatus,
    HarvestRecordStatus,
    ProductionRecordStatus,
    TraceabilityRecordStatus,
} from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { create as recordActivity } from '@/routes/farm-activities';
import { create as addFinancing, edit as editFinancing } from '@/routes/farms/financing';
import { index as inventoryIndex } from '@/routes/inventory';
import { show as showLot } from '@/routes/traceability';
import { create as addInsurance, edit as editInsurance } from '@/routes/farms/insurance';
import { create as recordHarvest } from '@/routes/harvest';
import { show as showFarmer } from '@/routes/farmers';
import { create as addProduction } from '@/routes/production';
import { index as farmsIndex, show, edit } from '@/routes/farms';

type FarmProfile = {
    id: number;
    farm_id: string;
    farm_name: string;
    crop_label: string;
    declared_area_hectares: number;
    measured_area: string;
    verified_area: string;
    difference: string;
    variance: string;
    boundary: {
        geojson: BoundaryGeoJson;
        gps_measured_area_hectares: number;
        captured_by: string | null;
        captured_at: string | null;
        updated_by: string | null;
        updated_at: string | null;
    } | null;
    can_manage_boundary: boolean;
    can_remove_boundary: boolean;
    verifications: VerificationHistoryRow[];
    purok_sitio: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
    latitude: string | null;
    longitude: string | null;
    verification_status: FarmStatus;
    status: FarmerRecordStatus;
    notes: string | null;
    registered_at: string | null;
    updated_at: string | null;
    farmer: {
        id: number;
        farmer_id: string;
        full_name: string;
    };
    can_edit: boolean;
    can_record_activity: boolean;
    recent_activity: string;
    activity_summary: {
        total: number;
        completed: number;
        in_progress: number;
        planned: number;
        cancelled: number;
    };
    activities: {
        id: number;
        activity_date: string | null;
        status: ActivityRecordStatus;
        description: string | null;
        crop_label: string;
        activity_type: string | null;
        performed_by: string | null;
        cost: string;
    }[];
    can_record_production: boolean;
    production_summary: {
        expected_label: string;
        actual_label: string;
        remaining_label: string;
        exceeds: boolean;
        message: string | null;
        progress: number | null;
        has_records: boolean;
    };
    productions: {
        id: number;
        crop_label: string;
        production_period: string | null;
        expected_label: string;
        harvested_label: string;
        remaining_label: string;
        exceeds: boolean;
        message: string | null;
        progress: number | null;
        status: ProductionRecordStatus;
        unit: string;
    }[];
    harvests: {
        id: number;
        harvest_date: string | null;
        crop_label: string;
        quantity_label: string;
        unit: string;
        quality_grade: string | null;
        status: HarvestRecordStatus;
    }[];
    can_manage_coverage: boolean;
    insurances: InsuranceRecord[];
    financings: FinancingRecord[];
    inventory_summary: InventorySummary;
    traceability_lots: {
        id: number;
        lot_code: string;
        quantity_label: string;
        stage: string | null;
        status: TraceabilityRecordStatus;
    }[];
    reference: {
        owner_name: string;
        current_stage_label: string;
        property_ownership_label: string;
        number_of_hills_label: string;
        data_validated: string;
        contracted_value: string;
        input_support: string;
        financing_support: string;
        geolocation: string;
        boundary_status: string;
        drone_image_url: string | null;
    };
};

const tabs = [
    'Overview',
    'Map',
    'Verification History',
    'Activities',
    'Production',
    'Harvest',
    'Crop Insurance',
    'Financing',
    'Inventory',
    'Traceability',
    'Documents',
] as const;

type FarmTab = (typeof tabs)[number];

const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function display(value: string | null): string {
    return value && value.trim() !== '' ? value : '—';
}

function coordinate(value: string | null): string {
    if (!value || value.trim() === '') {
        return '—';
    }

    const number = Number(value);

    return Number.isNaN(number) ? value : String(number);
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

function initialTab(): FarmTab {
    if (typeof window === 'undefined') {
        return 'Overview';
    }

    const tab = new URLSearchParams(window.location.search).get('tab');

    if (tab === 'map') {
        return 'Map';
    }

    if (tab === 'history') {
        return 'Verification History';
    }

    if (tab === 'activities') {
        return 'Activities';
    }

    if (tab === 'production') {
        return 'Production';
    }

    if (tab === 'harvest') {
        return 'Harvest';
    }

    if (tab === 'insurance') {
        return 'Crop Insurance';
    }

    if (tab === 'financing') {
        return 'Financing';
    }

    if (tab === 'inventory') {
        return 'Inventory';
    }

    if (tab === 'traceability') {
        return 'Traceability';
    }

    return 'Overview';
}

export default function FarmProfilePage({ farm }: { farm: FarmProfile }) {
    const [tab, setTab] = useState<FarmTab>(initialTab);
    const [mapOpened, setMapOpened] = useState(
        () => initialTab() === 'Map',
    );

    function selectTab(item: FarmTab) {
        setTab(item);

        if (item === 'Map') {
            setMapOpened(true);
        }
    }

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Farms & Map',
                href: farmsIndex(),
            },
            {
                title: farm.farm_name,
                href: show(farm.id),
            },
        ],
    });

    return (
        <>
            <Head title={farm.farm_name} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={farm.farm_name}
                    description={`${farm.farm_id} · ${farm.crop_label}`}
                    actions={
                        farm.can_edit ? (
                            <Button asChild>
                                <Link href={edit(farm.id)}>
                                    <Pencil />
                                    Edit
                                </Link>
                            </Button>
                        ) : null
                    }
                />

                <Card className="shadow-none">
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={farm.verification_status} />
                            <FarmerStatusBadge status={farm.status} />
                        </div>
                        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Detail label="Farm ID" value={farm.farm_id} />
                            <Detail label="Crop Type" value={farm.crop_label} />
                            <div className="grid gap-1">
                                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Farmer
                                </dt>
                                <dd className="text-sm">
                                    <Link
                                        href={showFarmer(farm.farmer.id)}
                                        className="font-medium text-primary underline-offset-4 hover:underline"
                                    >
                                        {farm.farmer.full_name}
                                    </Link>
                                    <span className="text-muted-foreground">
                                        {' '}
                                        · {farm.farmer.farmer_id}
                                    </span>
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
                    <StatCard
                        label="Declared Area"
                        value={`${areaFormatter.format(farm.declared_area_hectares)} ha`}
                    />
                    <StatCard
                        label="Measured Area"
                        value={farm.measured_area}
                    />
                    <StatCard
                        label="Verified Area"
                        value={farm.verified_area}
                    />
                    <StatCard label="Difference" value={farm.difference} />
                    <StatCard label="Variance" value={farm.variance} />
                </section>

                <div className="flex gap-1 overflow-x-auto border-b">
                    {tabs.map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => selectTab(item)}
                            className={cn(
                                'shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
                                tab === item
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground',
                            )}
                        >
                            {item}
                        </button>
                    ))}
                </div>

                {tab === 'Overview' && (
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="shadow-none lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Area</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-4 sm:grid-cols-2">
                                    <Detail
                                        label="Difference"
                                        value={farm.difference}
                                    />
                                    <Detail
                                        label="Variance"
                                        value={farm.variance}
                                    />
                                </dl>
                                <p className="mt-4 text-xs text-muted-foreground">
                                    Declared area is the area the farmer
                                    reported. Measured area comes from the
                                    saved map boundary. Verified area is
                                    recorded only when verification is
                                    approved.
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Location</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-4 sm:grid-cols-2">
                                    <Detail
                                        label="Purok / Sitio"
                                        value={display(farm.purok_sitio)}
                                    />
                                    <Detail
                                        label="Barangay"
                                        value={display(farm.barangay)}
                                    />
                                    <Detail
                                        label="Municipality"
                                        value={display(farm.municipality)}
                                    />
                                    <Detail
                                        label="Province"
                                        value={display(farm.province)}
                                    />
                                    <Detail
                                        label="Latitude"
                                        value={coordinate(farm.latitude)}
                                    />
                                    <Detail
                                        label="Longitude"
                                        value={coordinate(farm.longitude)}
                                    />
                                </dl>
                            </CardContent>
                        </Card>
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Farm details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-4 sm:grid-cols-2">
                                    <Detail
                                        label="Owner / Farmer"
                                        value={farm.reference.owner_name}
                                    />
                                    <Detail
                                        label="Property"
                                        value={farm.reference.property_ownership_label}
                                    />
                                    <Detail
                                        label="Current Stage"
                                        value={farm.reference.current_stage_label}
                                    />
                                    <Detail
                                        label="Recent Activity"
                                        value={farm.recent_activity}
                                    />
                                    <Detail
                                        label="Expected Production"
                                        value={farm.production_summary.expected_label}
                                    />
                                    <Detail
                                        label="Actual Harvest"
                                        value={farm.production_summary.actual_label}
                                    />
                                    <Detail
                                        label="Remaining Expected"
                                        value={farm.production_summary.remaining_label}
                                    />
                                    <Detail
                                        label="No. of Hills"
                                        value={farm.reference.number_of_hills_label}
                                    />
                                    <Detail
                                        label="Data validation"
                                        value={farm.reference.data_validated}
                                    />
                                    <Detail
                                        label="Geolocation"
                                        value={farm.reference.geolocation}
                                    />
                                    <Detail
                                        label="Boundary"
                                        value={farm.reference.boundary_status}
                                    />
                                    <Detail
                                        label="Notes"
                                        value={display(farm.notes)}
                                    />
                                </dl>
                            </CardContent>
                        </Card>
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Support</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-4 sm:grid-cols-2">
                                    <Detail
                                        label="Contracted Value"
                                        value={farm.reference.contracted_value}
                                    />
                                    <Detail
                                        label="Input Support"
                                        value={farm.reference.input_support}
                                    />
                                    <Detail
                                        label="Financing Support"
                                        value={farm.reference.financing_support}
                                    />
                                </dl>
                                <p className="mt-4 text-xs text-muted-foreground">
                                    These amounts are reference data for the
                                    farm. They are not income, profit, or an
                                    accounting entry.
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-none">
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Crop Insurance</CardTitle>
                                {farm.can_manage_coverage && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={addInsurance(farm.id)}>
                                            <Plus />
                                            Add
                                        </Link>
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {farm.insurances[0] ? (
                                    <CropInsuranceDetails record={farm.insurances[0]} />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No crop insurance recorded.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="shadow-none">
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Financing</CardTitle>
                                {farm.can_manage_coverage && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={addFinancing(farm.id)}>
                                            <Plus />
                                            Add
                                        </Link>
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {farm.financings[0] ? (
                                    <FinancingDetails record={farm.financings[0]} />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No financing recorded.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Record</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-4 sm:grid-cols-2">
                                    <Detail
                                        label="Registered Date"
                                        value={display(farm.registered_at)}
                                    />
                                    <Detail
                                        label="Last Updated"
                                        value={display(farm.updated_at)}
                                    />
                                </dl>
                            </CardContent>
                        </Card>
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Drone image</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {farm.reference.drone_image_url ? (
                                    <img
                                        src={farm.reference.drone_image_url}
                                        alt={`${farm.farm_name} drone image`}
                                        className="max-h-72 w-full rounded-lg object-cover"
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Drone image not available
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {mapOpened && (
                <div className={tab === 'Map' ? undefined : 'hidden'}>
                    <FarmBoundaryMap
                        active={tab === 'Map'}
                        farm={{
                            id: farm.id,
                            farm_name: farm.farm_name,
                            declared_area_hectares:
                                farm.declared_area_hectares,
                            verification_status: farm.verification_status,
                            latitude: farm.latitude,
                            longitude: farm.longitude,
                            farmer_name: farm.farmer.full_name,
                            can_manage_boundary: farm.can_manage_boundary,
                            can_remove_boundary: farm.can_remove_boundary,
                        }}
                        boundary={farm.boundary}
                    />
                </div>
                )}

                {tab === 'Verification History' &&
                    (farm.verifications.length === 0 ? (
                        <EmptyState
                            title="No verification records yet."
                            description="Verification history will appear here after a farm is reviewed."
                        />
                    ) : (
                        <FarmVerificationHistory rows={farm.verifications} />
                    ))}

                {tab === 'Activities' && (
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                            {[
                                ['Activities', farm.activity_summary.total],
                                ['Completed', farm.activity_summary.completed],
                                ['In Progress', farm.activity_summary.in_progress],
                                ['Planned', farm.activity_summary.planned],
                                ['Cancelled', farm.activity_summary.cancelled],
                            ].map(([label, value]) => (
                                <div
                                    key={String(label)}
                                    className="rounded-xl border bg-card px-3 py-3"
                                >
                                    <p className="text-xs text-muted-foreground">
                                        {label}
                                    </p>
                                    <p className="text-xl font-semibold tabular-nums">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {farm.can_record_activity && farm.activities.length > 0 && (
                            <div className="flex justify-end">
                                <Button asChild>
                                    <Link
                                        href={recordActivity.url({
                                            query: { farm: farm.id },
                                        })}
                                    >
                                        <Plus />
                                        Record Activity
                                    </Link>
                                </Button>
                            </div>
                        )}

                        {farm.activities.length === 0 ? (
                            <EmptyState
                                title="No activities recorded for this farm."
                                description="Activities recorded here stay on this farm."
                                action={
                                    farm.can_record_activity ? (
                                        <Button asChild>
                                            <Link
                                                href={recordActivity.url({
                                                    query: { farm: farm.id },
                                                })}
                                            >
                                                <Plus />
                                                Record Activity
                                            </Link>
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <ol className="border-l pl-6">
                                {farm.activities.map((activity) => (
                                    <li
                                        key={activity.id}
                                        className="relative pb-6 last:pb-0"
                                    >
                                        <span className="absolute top-1.5 -left-[1.7rem] size-3 rounded-full border-2 border-primary bg-background" />
                                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            {activity.activity_date}
                                        </p>
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-medium">
                                                {activity.activity_type}
                                            </p>
                                            <ActivityStatusBadge
                                                status={activity.status}
                                            />
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {activity.crop_label}
                                            {activity.performed_by
                                                ? ` · ${activity.performed_by}`
                                                : ''}
                                            {activity.cost !== '—'
                                                ? ` · ${activity.cost}`
                                                : ''}
                                        </p>
                                        {activity.description && (
                                            <p className="mt-1 text-sm">
                                                {activity.description}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                )}

                {tab === 'Production' && (
                    <div className="grid gap-4">
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Production</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ProductionBalance
                                    expected={farm.production_summary.expected_label}
                                    actual={farm.production_summary.actual_label}
                                    remaining={farm.production_summary.remaining_label}
                                    exceeds={farm.production_summary.exceeds}
                                    message={farm.production_summary.message}
                                    progress={farm.production_summary.progress}
                                />
                            </CardContent>
                        </Card>
                        {farm.productions.length === 0 ? (
                            <EmptyState
                                title="No production records yet."
                                description="Expected quantities for this farm will appear here."
                                action={
                                    farm.can_record_production ? (
                                        <Button asChild>
                                            <Link href={addProduction.url({ query: { farm: farm.id } })}>
                                                <Plus />
                                                Add Production
                                            </Link>
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <div className="grid gap-3">
                                {farm.can_record_production && (
                                    <div className="flex justify-end">
                                        <Button asChild>
                                            <Link href={addProduction.url({ query: { farm: farm.id } })}>
                                                <Plus />
                                                Add Production
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                                {farm.productions.map((production) => (
                                    <Card key={production.id} className="shadow-none">
                                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                                            <CardTitle className="text-base">
                                                {production.crop_label}
                                                {production.production_period ? ` · ${production.production_period}` : ''}
                                            </CardTitle>
                                            <ProductionStatusBadge status={production.status} />
                                        </CardHeader>
                                        <CardContent className="grid gap-2">
                                            <p className="text-sm text-muted-foreground">
                                                Expected {production.expected_label} · Harvested {production.harvested_label} · Remaining {production.remaining_label}
                                            </p>
                                            <ProductionBalance
                                                expected={production.expected_label}
                                                actual={production.harvested_label}
                                                remaining={production.remaining_label}
                                                exceeds={production.exceeds}
                                                message={production.message}
                                                progress={production.progress}
                                            />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'Harvest' && (
                    <div className="grid gap-4">
                        {farm.harvests.length === 0 ? (
                            <EmptyState
                                title="No harvest records yet."
                                description="Harvest history will appear here after a harvest is recorded."
                                action={
                                    farm.can_record_production ? (
                                        <Button asChild>
                                            <Link href={recordHarvest.url({ query: { farm: farm.id } })}>
                                                <Plus />
                                                Record Harvest
                                            </Link>
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <div className="grid gap-3">
                                {farm.can_record_production && (
                                    <div className="flex justify-end">
                                        <Button asChild>
                                            <Link href={recordHarvest.url({ query: { farm: farm.id } })}>
                                                <Plus />
                                                Record Harvest
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                                <div className="overflow-hidden rounded-xl border bg-card">
                                    <table className="w-full text-sm">
                                        <thead className="border-b bg-muted/50">
                                            <tr>
                                                {['Date', 'Crop', 'Quantity', 'Unit', 'Quality', 'Status'].map((column) => (
                                                    <th key={column} className="h-11 px-4 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                        {column}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {farm.harvests.map((harvest) => (
                                                <tr key={harvest.id} className="border-b last:border-0">
                                                    <td className="px-4 py-3">{harvest.harvest_date}</td>
                                                    <td className="px-4 py-3">{harvest.crop_label}</td>
                                                    <td className="px-4 py-3 tabular-nums">{harvest.quantity_label}</td>
                                                    <td className="px-4 py-3">{harvest.unit}</td>
                                                    <td className="px-4 py-3">{harvest.quality_grade || '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <HarvestStatusBadge status={harvest.status} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'Crop Insurance' && (
                    <div className="grid gap-4">
                        {farm.can_manage_coverage && (
                            <div className="flex justify-end">
                                <Button asChild>
                                    <Link href={addInsurance(farm.id)}>
                                        <Plus />
                                        Add Crop Insurance
                                    </Link>
                                </Button>
                            </div>
                        )}
                        {farm.insurances.length === 0 ? (
                            <EmptyState
                                title="No crop insurance recorded."
                                description="Coverage, amount, and term are kept with this farm."
                            />
                        ) : (
                            farm.insurances.map((insurance) => (
                                <Card key={insurance.id} className="shadow-none">
                                    <CardHeader className="flex-row items-center justify-between">
                                        <CardTitle>Crop Insurance</CardTitle>
                                        {farm.can_manage_coverage && (
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={editInsurance({ farm: farm.id, insurance: insurance.id })}>
                                                    <Pencil />
                                                    Edit
                                                </Link>
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <CropInsuranceDetails record={insurance} />
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                )}

                {tab === 'Financing' && (
                    <div className="grid gap-4">
                        {farm.can_manage_coverage && (
                            <div className="flex justify-end">
                                <Button asChild>
                                    <Link href={addFinancing(farm.id)}>
                                        <Plus />
                                        Add Financing
                                    </Link>
                                </Button>
                            </div>
                        )}
                        {farm.financings.length === 0 ? (
                            <EmptyState
                                title="No financing recorded."
                                description="Amount, date granted, loan balance, and financing type are kept with this farm."
                            />
                        ) : (
                            farm.financings.map((financing) => (
                                <Card key={financing.id} className="shadow-none">
                                    <CardHeader className="flex-row items-center justify-between">
                                        <CardTitle>Financing</CardTitle>
                                        {farm.can_manage_coverage && (
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={editFinancing({ farm: farm.id, financing: financing.id })}>
                                                    <Pencil />
                                                    Edit
                                                </Link>
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <FinancingDetails record={financing} />
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                )}

                {tab === 'Inventory' && (
                    <Card className="shadow-none">
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>Inventory</CardTitle>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={inventoryIndex.url({ query: { farm: farm.id } })}>
                                    View inventory
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {farm.inventory_summary.has_records ? (
                                <InventoryStageBars summary={farm.inventory_summary} />
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No inventory records yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {tab === 'Traceability' && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Traceability lots</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {farm.traceability_lots.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No traceability lots yet.</p>
                            ) : (
                                <ul className="grid gap-3">
                                    {farm.traceability_lots.map((lot) => (
                                        <li key={lot.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="font-medium">{lot.lot_code}</p>
                                                <p className="text-sm text-muted-foreground">{lot.quantity_label} · {lot.stage ?? 'Coffee'}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <TraceabilityStatusBadge status={lot.status} />
                                                <Link href={showLot(lot.id)} className="text-sm font-medium text-primary hover:underline">View traceability</Link>
                                                <Link href={showLot(lot.id)} className="text-sm font-medium text-primary hover:underline">View QR</Link>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                )}

                {tab === 'Documents' && (
                    <EmptyState
                        title="No documents yet."
                        description="Farm documents will be listed here when that module is available."
                    />
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" asChild>
                        <Link href={showFarmer(farm.farmer.id)}>
                            Back to farmer
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href={farmsIndex()}>Back to farms</Link>
                    </Button>
                </div>
            </div>
        </>
    );
}

FarmProfilePage.layout = {
    breadcrumbs: [
        {
            title: 'Farms & Map',
            href: farmsIndex(),
        },
    ],
};
