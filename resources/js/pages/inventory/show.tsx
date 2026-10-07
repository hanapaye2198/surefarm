import { Head, Link } from '@inertiajs/react';
import { InventoryStatusBadge } from '@/components/status-badge';
import type { InventoryRecordStatus } from '@/components/status-badge';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';
import { show as showHarvest } from '@/routes/harvest';
import { create as adjustInventory } from '@/routes/inventory/adjust';
import { create as damageInventory } from '@/routes/inventory/damage';
import { index as inventoryIndex, show } from '@/routes/inventory';
import { create as processInventory } from '@/routes/inventory/process';
import { create as createLot } from '@/routes/traceability';

type InventoryDetail = {
    id: number;
    received_date_long: string | null;
    quantity_label: string;
    unit: string;
    status: InventoryRecordStatus;
    status_label: string;
    location: string | null;
    notes: string | null;
    crop_label: string;
    stage: { name: string } | null;
    farmer: { id: number; farmer_id: string; name: string } | null;
    farm: { id: number; farm_id: string; farm_name: string } | null;
    harvest: { id: number; label: string; harvest_date: string | null; quantity_label: string | null } | null;
};

type Movement = {
    id: number;
    movement_date: string;
    movement_date_long: string;
    movement_type_label: string;
    summary: string;
    notes: string | null;
    created_by: string | null;
};

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function InventoryShow({
    inventory,
    movements,
    can_manage,
    can_process,
    can_trace,
    next_stage,
}: {
    inventory: InventoryDetail;
    movements: Movement[];
    can_manage: boolean;
    can_process: boolean;
    can_trace: boolean;
    next_stage: { id: number; name: string } | null;
}) {
    return (
        <>
            <Head title={inventory.stage?.name ?? 'Inventory'} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={inventory.stage?.name ?? 'Inventory'}
                    description={inventory.quantity_label}
                    actions={
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {can_trace && (
                                <Button asChild>
                                    <Link href={createLot.url({ query: { inventory: inventory.id } })}>
                                        Create traceability lot
                                    </Link>
                                </Button>
                            )}
                            {can_process && (
                                <Button asChild>
                                    <Link href={processInventory.url({ query: { inventory: inventory.id } })}>
                                        Process coffee
                                    </Link>
                                </Button>
                            )}
                            {can_manage && (
                                <>
                                    <Button variant="outline" asChild>
                                        <Link href={adjustInventory.url(inventory.id)}>Adjust</Link>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href={damageInventory.url(inventory.id)}>Mark as damaged</Link>
                                    </Button>
                                </>
                            )}
                            <Button variant="outline" asChild>
                                <Link href={inventoryIndex()}>Back to inventory</Link>
                            </Button>
                        </div>
                    }
                />

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>{inventory.quantity_label}</CardTitle>
                        <InventoryStatusBadge status={inventory.status} />
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail label="Processing stage" value={inventory.stage?.name ?? '—'} />
                            <Detail label="Unit" value={inventory.unit} />
                            <Detail label="Status" value={inventory.status_label} />
                            <Detail label="Location" value={display(inventory.location)} />
                            <Detail label="Received date" value={display(inventory.received_date_long)} />
                            <Detail label="Crop" value={inventory.crop_label} />
                            <Detail label="Farmer" value={inventory.farmer?.name ?? '—'} href={inventory.farmer ? showFarmer(inventory.farmer.id).url : undefined} />
                            <Detail label="Farm" value={inventory.farm?.farm_name ?? '—'} href={inventory.farm ? showFarm(inventory.farm.id).url : undefined} />
                            <Detail label="Harvest" value={inventory.harvest?.label ?? '—'} href={inventory.harvest ? showHarvest(inventory.harvest.id).url : undefined} />
                            <Detail label="Notes" value={display(inventory.notes)} />
                        </dl>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Origin</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail label="Farmer" value={inventory.farmer ? `${inventory.farmer.name} · ${inventory.farmer.farmer_id}` : '—'} />
                            <Detail label="Farm" value={inventory.farm ? `${inventory.farm.farm_name} · ${inventory.farm.farm_id}` : '—'} />
                            <Detail label="Harvest" value={inventory.harvest?.harvest_date ?? inventory.harvest?.label ?? '—'} />
                            <Detail label="Harvest quantity" value={inventory.harvest?.quantity_label ?? '—'} />
                        </dl>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Processing history</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {movements.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No processing movements yet.</p>
                        ) : (
                            movements.map((movement) => (
                                <div key={movement.id} className="border-b pb-4 last:border-0 last:pb-0">
                                    <p className="text-sm font-medium">{movement.movement_date_long}</p>
                                    <p className="text-sm">{movement.summary}</p>
                                    {movement.notes && <p className="text-sm text-muted-foreground">{movement.notes}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        {movement.movement_type_label}
                                        {movement.created_by ? ` · ${movement.created_by}` : ''}
                                    </p>
                                </div>
                            ))
                        )}
                        {next_stage && can_process && (
                            <p className="text-sm text-muted-foreground">
                                Next stage: {next_stage.name}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function Detail({ label, value, href }: { label: string; value: string; href?: string }) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-1 text-sm">
                {href ? <Link href={href} className="font-medium hover:underline">{value}</Link> : value}
            </dd>
        </div>
    );
}

InventoryShow.layout = {
    breadcrumbs: [
        {
            title: 'Inventory',
            href: inventoryIndex(),
        },
    ],
};
