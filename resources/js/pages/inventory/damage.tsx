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
import { store } from '@/routes/inventory/damage';
import { show } from '@/routes/inventory';

type InventoryDetail = {
    id: number;
    quantity_label: string;
    unit: string;
    stage: { name: string } | null;
};

export default function DamageInventory({
    inventory,
    today,
}: {
    inventory: InventoryDetail;
    today: string;
}) {
    const [confirming, setConfirming] = useState(false);
    const form = useForm({
        quantity: '',
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

    function saveDamage() {
        form.post(store.url(inventory.id), {
            onError: () => setConfirming(false),
        });
    }

    return (
        <>
            <Head title="Mark as Damaged" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Mark as Damaged"
                    description={`${inventory.stage?.name ?? 'Coffee'} · available ${inventory.quantity_label}. Damaged coffee stays in the history.`}
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
                            <CardTitle>Damage</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="quantity">
                                    Damaged quantity ({inventory.unit})
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
                            {form.processing ? 'Saving...' : 'Record damage'}
                        </Button>
                    </div>
                </form>
                <ConfirmAction
                    open={confirming}
                    title="Record damaged coffee?"
                    description={`This removes ${form.data.quantity} ${inventory.unit} from the available ${inventory.quantity_label}. The damaged quantity stays in the movement history.`}
                    confirmLabel="Record damage"
                    pending={form.processing}
                    destructive
                    onOpenChange={setConfirming}
                    onConfirm={saveDamage}
                />
            </div>
        </>
    );
}
