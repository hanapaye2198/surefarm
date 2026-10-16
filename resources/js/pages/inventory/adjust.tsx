import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { ConfirmAction } from '@/components/confirm-action';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store } from '@/routes/inventory/adjust';
import { show } from '@/routes/inventory';

type InventoryDetail = {
    id: number;
    quantity_label: string;
    unit: string;
    stage: { name: string } | null;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function AdjustInventory({
    inventory,
    today,
}: {
    inventory: InventoryDetail;
    today: string;
}) {
    const [confirming, setConfirming] = useState(false);
    const form = useForm({
        quantity: '',
        direction: 'decrease',
        reason: '',
        movement_date: today,
    });

    function submit(event: FormEvent) {
        event.preventDefault();

        if (
            form.data.quantity.trim() === '' ||
            form.data.reason.trim() === '' ||
            form.data.movement_date.trim() === ''
        ) {
            form.post(store.url(inventory.id));

            return;
        }

        setConfirming(true);
    }

    function saveAdjustment() {
        form.post(store.url(inventory.id), {
            onError: () => setConfirming(false),
        });
    }

    return (
        <>
            <Head title="Adjust Inventory" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Adjust Inventory"
                    description={`${inventory.stage?.name ?? 'Coffee'} · current ${inventory.quantity_label}`}
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={show(inventory.id)}>
                                Back to inventory
                            </Link>
                        </Button>
                    }
                />
                <form onSubmit={submit} className="grid gap-4">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Adjustment</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="direction">Direction</Label>
                                <select
                                    id="direction"
                                    className={selectClassName}
                                    value={form.data.direction}
                                    onChange={(event) =>
                                        form.setData(
                                            'direction',
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="decrease">Decrease</option>
                                    <option value="increase">Increase</option>
                                </select>
                                <InputError message={form.errors.direction} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="quantity">
                                    Quantity ({inventory.unit})
                                    <span
                                        className="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {' '}
                                        *
                                    </span>
                                </Label>
                                <Input
                                    id="quantity"
                                    inputMode="decimal"
                                    required
                                    aria-required="true"
                                    value={form.data.quantity}
                                    onChange={(event) =>
                                        form.setData(
                                            'quantity',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.quantity} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="movement_date">Date</Label>
                                <Input
                                    id="movement_date"
                                    type="date"
                                    value={form.data.movement_date}
                                    onChange={(event) =>
                                        form.setData(
                                            'movement_date',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={form.errors.movement_date}
                                />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor="reason">
                                    Reason
                                    <span
                                        className="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {' '}
                                        *
                                    </span>
                                </Label>
                                <Input
                                    id="reason"
                                    required
                                    aria-required="true"
                                    value={form.data.reason}
                                    onChange={(event) =>
                                        form.setData(
                                            'reason',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.reason} />
                            </div>
                        </CardContent>
                    </Card>
                    <div>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing ? 'Saving...' : 'Save adjustment'}
                        </Button>
                    </div>
                </form>
                <ConfirmAction
                    open={confirming}
                    title="Record this adjustment?"
                    description={`This ${form.data.direction === 'increase' ? 'increases' : 'decreases'} the current ${inventory.quantity_label} by ${form.data.quantity} ${inventory.unit}. The movement stays in the inventory history.`}
                    confirmLabel="Record adjustment"
                    pending={form.processing}
                    onOpenChange={setConfirming}
                    onConfirm={saveAdjustment}
                />
            </div>
        </>
    );
}
