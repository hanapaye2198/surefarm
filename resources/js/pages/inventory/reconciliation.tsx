import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { index as inventoryIndex, reconciliation, show } from '@/routes/inventory';
import { update } from '@/routes/inventory/reconciliation';

type Discrepancy = {
    id: number;
    stored: string;
    movements: string;
    unit: string;
    farm: string | null;
    stage: string | null;
};

type IncompatibleReceipt = {
    movement_id: number;
    inventory_id: number | null;
    harvest_id: number;
    receipt_unit: string;
    harvest_unit: string;
    quantity: string;
};

export default function InventoryReconciliation({
    discrepancies,
    incompatible_receipts,
}: {
    discrepancies: Discrepancy[];
    incompatible_receipts: IncompatibleReceipt[];
}) {
    return (
        <>
            <Head title="Stock reconciliation" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Stock reconciliation"
                    description="Compare each stored balance with the sum of its movements. A correction changes the stored quantity only."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={inventoryIndex()}>Back to inventory</Link>
                        </Button>
                    }
                />

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Stored balance differs from movements</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {discrepancies.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Stored balances match recorded movements.</p>
                        ) : (
                            discrepancies.map((row) => (
                                <div key={row.id} className="grid gap-3 border-b pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_16rem] sm:items-end">
                                    <div className="text-sm">
                                        <Link href={show(row.id)} className="font-medium hover:underline">
                                            {row.stage ?? 'Inventory'} · {row.farm ?? 'Farm'}
                                        </Link>
                                        <p className="text-muted-foreground">
                                            Stored {row.stored} {row.unit}. Movements total {row.movements} {row.unit}.
                                        </p>
                                    </div>
                                    <CorrectionForm inventoryId={row.id} />
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Receipts in a different unit</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <p className="text-sm text-muted-foreground">
                            kg, tons, and bags are not converted. These receipts were saved before that rule. Reverse a receipt from its inventory record when no later movement exists.
                        </p>
                        {incompatible_receipts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No mismatched receipt units.</p>
                        ) : (
                            incompatible_receipts.map((receipt) => (
                                <div key={receipt.movement_id} className="border-b pb-4 text-sm last:border-0 last:pb-0">
                                    <p>
                                        {receipt.quantity} {receipt.receipt_unit} received against a {receipt.harvest_unit} harvest.
                                    </p>
                                    {receipt.inventory_id !== null && (
                                        <Link href={show(receipt.inventory_id)} className="font-medium hover:underline">
                                            Open inventory
                                        </Link>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function CorrectionForm({ inventoryId }: { inventoryId: number }) {
    const form = useForm({ reason: '' });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(update.url(inventoryId));
    }

    return (
        <form onSubmit={submit} className="grid gap-2">
            <Label htmlFor={`reason-${inventoryId}`}>Reason</Label>
            <Input
                id={`reason-${inventoryId}`}
                value={form.data.reason}
                onChange={(event) => form.setData('reason', event.target.value)}
            />
            <InputError message={form.errors.reason} />
            <Button type="submit" variant="outline" disabled={form.processing}>
                Set stored balance to movements
            </Button>
        </form>
    );
}

InventoryReconciliation.layout = {
    breadcrumbs: [
        {
            title: 'Inventory',
            href: inventoryIndex(),
        },
        {
            title: 'Reconciliation',
            href: reconciliation(),
        },
    ],
};
