import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { FarmerStatusBadge, StatusBadge } from '@/components/status-badge';
import type { FarmStatus, FarmerRecordStatus } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { create as registerFarm } from '@/routes/farmers/farms';
import { edit as editFarm, show as showFarm } from '@/routes/farms';

export type PortfolioFarm = {
    id: number;
    number: number;
    number_label: string;
    farm_id: string;
    farm_name: string;
    owner_name: string;
    crop: string;
    crop_label: string;
    status: FarmerRecordStatus;
    status_label: string;
    verification_status: FarmStatus;
    current_stage: string | null;
    current_stage_label: string;
    property_ownership: string | null;
    property_ownership_label: string;
    location: string;
    address: string;
    declared_area_hectares: number;
    declared_area: string;
    measured_area: string;
    verified_area: string;
    difference: string;
    variance: string;
    number_of_hills: number | null;
    number_of_hills_label: string;
    geolocation: string;
    has_geolocation: boolean;
    latitude: string | null;
    longitude: string | null;
    boundary_status: string;
    data_validated: string;
    contracted_value: string;
    input_support: string;
    financing_support: string;
    drone_image_url: string | null;
};

type FilterOption = {
    value: string;
    label: string;
};

export type FarmFilterOptions = {
    crops: FilterOption[];
    statuses: FilterOption[];
    verification_statuses: FilterOption[];
    stages: FilterOption[];
    ownerships: FilterOption[];
};

const selectClass =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

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

function FarmCard({
    farm,
    canEdit,
}: {
    farm: PortfolioFarm;
    canEdit: boolean;
}) {
    return (
        <Card className="shadow-none">
            <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {farm.number_label}
                        </p>
                        <CardTitle>{farm.farm_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Farm ID: {farm.farm_id}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <FarmerStatusBadge status={farm.status} />
                        <StatusBadge status={farm.verification_status} />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4">
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Location" value={farm.location} />
                    <Detail label="Crop" value={farm.crop_label} />
                    <Detail label="Declared Area" value={farm.declared_area} />
                    <Detail label="Measured Area" value={farm.measured_area} />
                    <Detail label="Verified Area" value={farm.verified_area} />
                    <Detail label="Difference" value={farm.difference} />
                    <Detail label="Variance" value={farm.variance} />
                    <div className="grid gap-1">
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Property
                        </dt>
                        <dd>
                            <Badge variant="outline" className="uppercase">
                                {farm.property_ownership_label}
                            </Badge>
                        </dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Current Stage
                        </dt>
                        <dd>
                            <Badge variant="secondary" className="uppercase">
                                {farm.current_stage_label}
                            </Badge>
                        </dd>
                    </div>
                    <Detail label="No. of Hills" value={farm.number_of_hills_label} />
                    <Detail label="Geolocation" value={farm.geolocation} />
                </dl>
                <details className="rounded-lg border px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">
                        Support, ownership, and location
                    </summary>
                    <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Detail label="Owner / Farmer" value={farm.owner_name} />
                        <Detail label="Address" value={farm.address} />
                        <Detail label="Data validation" value={farm.data_validated} />
                        <Detail label="Boundary" value={farm.boundary_status} />
                        <Detail
                            label="Latitude"
                            value={farm.latitude ?? 'Not yet captured'}
                        />
                        <Detail
                            label="Longitude"
                            value={farm.longitude ?? 'Not yet captured'}
                        />
                        <Detail label="Contracted Value" value={farm.contracted_value} />
                        <Detail label="Input Support" value={farm.input_support} />
                        <Detail
                            label="Financing Support"
                            value={farm.financing_support}
                        />
                        <Detail
                            label="Drone Image"
                            value={farm.drone_image_url ? 'Available' : 'Not available'}
                        />
                    </dl>
                </details>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={showFarm(farm.id)}>View Farm</Link>
                    </Button>
                    {canEdit && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={editFarm(farm.id)}>Edit</Link>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export function FarmerFarmPortfolio({
    farmerId,
    farms,
    canRegister,
    filters,
}: {
    farmerId: number;
    farms: PortfolioFarm[];
    canRegister: boolean;
    filters: FarmFilterOptions;
}) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [verification, setVerification] = useState('');
    const [crop, setCrop] = useState('');
    const [ownership, setOwnership] = useState('');
    const [stage, setStage] = useState('');
    const [layout, setLayout] = useState<'cards' | 'table'>(
        farms.length > 4 ? 'table' : 'cards',
    );

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return farms.filter((farm) => {
            if (status !== '' && farm.status !== status) {
                return false;
            }

            if (
                verification !== '' &&
                farm.verification_status !== verification
            ) {
                return false;
            }

            if (crop !== '' && farm.crop !== crop) {
                return false;
            }

            if (ownership !== '' && farm.property_ownership !== ownership) {
                return false;
            }

            if (stage !== '' && farm.current_stage !== stage) {
                return false;
            }

            if (needle === '') {
                return true;
            }

            return [farm.farm_id, farm.farm_name, farm.location, farm.address]
                .join(' ')
                .toLowerCase()
                .includes(needle);
        });
    }, [crop, farms, ownership, query, stage, status, verification]);

    if (farms.length === 0) {
        return (
            <EmptyState
                title="No farms registered yet."
                description="Register this farmer's first farm to begin mapping, verification, and agricultural management."
                action={
                    canRegister ? (
                        <Button asChild>
                            <Link href={registerFarm(farmerId)}>
                                <Plus />
                                Register First Farm
                            </Link>
                        </Button>
                    ) : null
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Farmer Farms</h2>
                    <p className="text-sm text-muted-foreground">
                        All farms registered under this farmer.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {farms.length} registered{' '}
                        {farms.length === 1 ? 'farm' : 'farms'}
                    </p>
                </div>
                {canRegister && (
                    <Button asChild>
                        <Link href={registerFarm(farmerId)}>
                            <Plus />
                            Register Farm
                        </Link>
                    </Button>
                )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search farm ID, name, or location"
                    aria-label="Search farms"
                />
                <select
                    aria-label="Farm status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={selectClass}
                >
                    <option value="">All statuses</option>
                    {filters.statuses.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Verification"
                    value={verification}
                    onChange={(event) => setVerification(event.target.value)}
                    className={selectClass}
                >
                    <option value="">All verification</option>
                    {filters.verification_statuses.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Crop"
                    value={crop}
                    onChange={(event) => setCrop(event.target.value)}
                    className={selectClass}
                >
                    <option value="">All crops</option>
                    {filters.crops.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Property ownership"
                    value={ownership}
                    onChange={(event) => setOwnership(event.target.value)}
                    className={selectClass}
                >
                    <option value="">All property</option>
                    {filters.ownerships.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Current stage"
                    value={stage}
                    onChange={(event) => setStage(event.target.value)}
                    className={selectClass}
                >
                    <option value="">All stages</option>
                    {filters.stages.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex gap-2">
                {(['cards', 'table'] as const).map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => setLayout(item)}
                        className={cn(
                            'rounded-md border px-3 py-1.5 text-sm font-medium',
                            layout === item
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'text-muted-foreground',
                        )}
                    >
                        {item === 'cards' ? 'Cards' : 'Table'}
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <EmptyState
                    title="No farms match these filters."
                    description="Try a different farm name, status, crop, or location."
                />
            ) : layout === 'cards' ? (
                <div className="grid gap-4">
                    {visible.map((farm) => (
                        <FarmCard
                            key={farm.id}
                            farm={farm}
                            canEdit={canRegister}
                        />
                    ))}
                </div>
            ) : (
                <DataTable
                    columns={[
                        'Farm ID',
                        'Farm Name',
                        'Location',
                        'Crop',
                        'Declared Area',
                        'Verified Area',
                        'Farm Status',
                        'Verification',
                        'Actions',
                    ]}
                    rows={visible.map((farm) => ({
                        id: farm.id,
                        cells: [
                            <span key="id" className="font-medium">
                                {farm.farm_id}
                            </span>,
                            farm.farm_name,
                            farm.location,
                            farm.crop_label,
                            farm.declared_area,
                            farm.verified_area,
                            <FarmerStatusBadge key="status" status={farm.status} />,
                            <StatusBadge
                                key="verification"
                                status={farm.verification_status}
                            />,
                            <span key="actions" className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={showFarm(farm.id)}>View Farm</Link>
                                </Button>
                                {canRegister && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={editFarm(farm.id)}>Edit</Link>
                                    </Button>
                                )}
                            </span>,
                        ],
                    }))}
                    emptyTitle="No farms match these filters."
                    emptyDescription="Try a different farm name, status, crop, or location."
                />
            )}
        </div>
    );
}
