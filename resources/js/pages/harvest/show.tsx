import { Head, Link, usePage } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { HarvestStatusBadge } from '@/components/status-badge';
import type { HarvestRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { userCanAccess } from '@/lib/access';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';
import { edit, index as harvestIndex } from '@/routes/harvest';
import { create as receiveHarvest } from '@/routes/harvest/receive';
import { show as showProduction } from '@/routes/production';

type HarvestRecord = {
    id: number;
    harvest_date_long: string | null;
    quantity_label: string;
    unit: string;
    quality_grade: string | null;
    status: HarvestRecordStatus;
    notes: string | null;
    crop_label: string;
    production_id: number | null;
    production_period: string | null;
    farm: { id: number; farm_name: string } | null;
    farmer: { id: number; name: string } | null;
    created_by: string | null;
    created_at: string | null;
};

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function HarvestShow({
    harvest,
    can_edit,
    can_receive,
}: {
    harvest: HarvestRecord;
    can_edit: boolean;
    can_receive: boolean;
}) {
    const { auth } = usePage().props;
    const canEdit = can_edit && userCanAccess(auth.user?.role, ['operations']);

    return (
        <>
            <Head title="Harvest record" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={harvest.farm?.farm_name ?? 'Harvest'}
                    description={harvest.harvest_date_long ?? 'Harvest record'}
                    actions={
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {can_receive && (
                                <Button asChild>
                                    <Link href={receiveHarvest(harvest.id)}>
                                        Receive into Inventory
                                    </Link>
                                </Button>
                            )}
                            {canEdit && (
                                <Button variant="outline" asChild>
                                    <Link href={edit(harvest.id)}>Edit</Link>
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link href={harvestIndex()}>
                                    Back to harvest
                                </Link>
                            </Button>
                        </div>
                    }
                />

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>{harvest.quantity_label}</CardTitle>
                        <HarvestStatusBadge status={harvest.status} />
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail
                                label="Harvest date"
                                value={display(harvest.harvest_date_long)}
                            />
                            <Detail
                                label="Farm"
                                value={harvest.farm?.farm_name ?? '—'}
                                href={
                                    harvest.farm
                                        ? showFarm(harvest.farm.id).url
                                        : undefined
                                }
                            />
                            <Detail
                                label="Farmer"
                                value={harvest.farmer?.name ?? '—'}
                                href={
                                    harvest.farmer
                                        ? showFarmer(harvest.farmer.id).url
                                        : undefined
                                }
                            />
                            <Detail label="Crop" value={harvest.crop_label} />
                            <Detail label="Unit" value={harvest.unit} />
                            <Detail
                                label="Quality"
                                value={display(harvest.quality_grade)}
                            />
                            <Detail
                                label="Production record"
                                value={
                                    harvest.production_period ??
                                    (harvest.production_id
                                        ? 'Linked estimate'
                                        : '—')
                                }
                                href={
                                    harvest.production_id
                                        ? showProduction(harvest.production_id)
                                              .url
                                        : undefined
                                }
                            />
                            <Detail
                                label="Notes"
                                value={display(harvest.notes)}
                            />
                            <Detail
                                label="Recorded by"
                                value={display(harvest.created_by)}
                            />
                            <Detail
                                label="Recorded on"
                                value={display(harvest.created_at)}
                            />
                        </dl>
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
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
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

HarvestShow.layout = {
    breadcrumbs: [
        {
            title: 'Harvest',
            href: harvestIndex(),
        },
    ],
};
