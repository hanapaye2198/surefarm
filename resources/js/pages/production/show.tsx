import { Head, Link, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { ProductionBalance } from '@/components/production-balance';
import { HarvestStatusBadge, ProductionStatusBadge } from '@/components/status-badge';
import type { HarvestRecordStatus, ProductionRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { userCanAccess } from '@/lib/access';
import { create as recordHarvest, show as showHarvest } from '@/routes/harvest';
import { show as showFarm } from '@/routes/farms';
import { edit, index as productionIndex } from '@/routes/production';

type ProductionRecord = {
    id: number;
    production_period: string | null;
    expected_label: string;
    harvested_label: string;
    remaining_label: string;
    exceeds: boolean;
    progress: number | null;
    message: string | null;
    unit: string;
    notes: string | null;
    status: ProductionRecordStatus;
    crop_label: string;
    farm: { id: number; farm_id: string; farm_name: string } | null;
    farmer: { id: number; name: string } | null;
};

type HarvestRow = {
    id: number;
    harvest_date: string | null;
    quantity_label: string;
    quality_grade: string | null;
    status: HarvestRecordStatus;
    crop_label: string;
};

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function ProductionShow({
    production,
    harvests,
    can_edit,
}: {
    production: ProductionRecord;
    harvests: HarvestRow[];
    can_edit: boolean;
}) {
    const { auth } = usePage().props;
    const canEdit = can_edit && userCanAccess(auth.user?.role, ['operations']);

    return (
        <>
            <Head title="Production record" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={production.farm?.farm_name ?? 'Production'}
                    description={`${production.crop_label}${production.production_period ? ` · ${production.production_period}` : ''}`}
                    actions={
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {canEdit && (
                                <Button asChild>
                                    <Link
                                        href={recordHarvest.url({
                                            query: {
                                                farm: production.farm?.id,
                                                production: production.id,
                                            },
                                        })}
                                    >
                                        <Plus />
                                        Record Harvest
                                    </Link>
                                </Button>
                            )}
                            {canEdit && (
                                <Button variant="outline" asChild>
                                    <Link href={edit(production.id)}>Edit</Link>
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link href={productionIndex()}>Back to production</Link>
                            </Button>
                        </div>
                    }
                />

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Expected vs actual</CardTitle>
                        <ProductionStatusBadge status={production.status} />
                    </CardHeader>
                    <CardContent>
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

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail label="Farm" value={production.farm?.farm_name ?? '—'} href={production.farm ? showFarm(production.farm.id).url : undefined} />
                            <Detail label="Farmer" value={production.farmer?.name ?? '—'} />
                            <Detail label="Crop" value={production.crop_label} />
                            <Detail label="Period" value={display(production.production_period)} />
                            <Detail label="Unit" value={production.unit} />
                            <Detail label="Notes" value={display(production.notes)} />
                        </dl>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Linked harvests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {harvests.length === 0 ? (
                            <EmptyState
                                title="No harvest records yet."
                                description="Recorded harvests linked to this estimate appear here."
                            />
                        ) : (
                            <ul className="divide-y">
                                {harvests.map((harvest) => (
                                    <li key={harvest.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                        <div>
                                            <Link href={showHarvest(harvest.id)} className="text-sm font-medium hover:underline">
                                                {harvest.harvest_date}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">
                                                {harvest.crop_label} · {harvest.quantity_label}
                                                {harvest.quality_grade ? ` · ${harvest.quality_grade}` : ''}
                                            </p>
                                        </div>
                                        <HarvestStatusBadge status={harvest.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function Detail({
    label,
    value,
    href,
}: {
    label: string;
    value: string;
    href?: string;
}) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-1 text-sm">
                {href ? (
                    <Link href={href} className="font-medium hover:underline">
                        {value}
                    </Link>
                ) : (
                    value
                )}
            </dd>
        </div>
    );
}

ProductionShow.layout = {
    breadcrumbs: [
        {
            title: 'Production',
            href: productionIndex(),
        },
    ],
};
