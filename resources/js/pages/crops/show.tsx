import { Head, Link, usePage } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { ProductionStatusBadge } from '@/components/status-badge';
import type { ProductionRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { userCanAccess } from '@/lib/access';
import { edit, index as cropsIndex } from '@/routes/crops';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';

type CropRecord = {
    id: number;
    crop_label: string;
    variety: string | null;
    area_label: string | null;
    planted_on_label: string | null;
    status: ProductionRecordStatus;
    notes: string | null;
    farm: { id: number; farm_id: string; farm_name: string } | null;
    farmer: { id: number; name: string } | null;
};

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function CropShow({
    crop,
    can_edit,
}: {
    crop: CropRecord;
    can_edit: boolean;
}) {
    const { auth } = usePage().props;
    const canEdit = can_edit && userCanAccess(auth.user?.role, ['operations']);

    return (
        <>
            <Head title="Crop record" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={crop.farm?.farm_name ?? 'Crop record'}
                    description={`${crop.crop_label}${crop.variety ? ` · ${crop.variety}` : ''}`}
                    actions={
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {canEdit && (
                                <Button variant="outline" asChild>
                                    <Link href={edit(crop.id)}>Edit</Link>
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link href={cropsIndex()}>
                                    Back to crop management
                                </Link>
                            </Button>
                        </div>
                    }
                />

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Crop details</CardTitle>
                        <ProductionStatusBadge status={crop.status} />
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail
                                label="Farm"
                                value={crop.farm?.farm_name ?? '—'}
                                href={
                                    crop.farm
                                        ? showFarm(crop.farm.id).url
                                        : undefined
                                }
                            />
                            <Detail
                                label="Farmer"
                                value={crop.farmer?.name ?? '—'}
                                href={
                                    crop.farmer
                                        ? showFarmer(crop.farmer.id).url
                                        : undefined
                                }
                            />
                            <Detail label="Crop" value={crop.crop_label} />
                            <Detail
                                label="Variety"
                                value={display(crop.variety)}
                            />
                            <Detail
                                label="Planted area"
                                value={display(crop.area_label)}
                            />
                            <Detail
                                label="Planted date"
                                value={display(crop.planted_on_label)}
                            />
                            <Detail label="Notes" value={display(crop.notes)} />
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

CropShow.layout = {
    breadcrumbs: [
        {
            title: 'Crop Management',
            href: cropsIndex(),
        },
    ],
};
