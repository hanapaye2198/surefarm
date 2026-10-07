import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
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
    const form = useForm({
        quantity: '',
        direction: 'decrease',
        reason: '',
        movement_date: today,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(store.url(inventory.id));
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
                            <Link href={show(inventory.id)}>Back to inventory</Link>
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
                                <select id="direction" className={selectClassName} value={form.data.direction} onChange={(event) => form.setData('direction', event.target.value)}>
                                    <option value="decrease">Decrease</option>
                                    <option value="increase">Increase</option>
                                </select>
                                <InputError message={form.errors.direction} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="quantity">Quantity</Label>
                                <Input id="quantity" inputMode="decimal" value={form.data.quantity} onChange={(event) => form.setData('quantity', event.target.value)} />
                                <InputError message={form.errors.quantity} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="movement_date">Date</Label>
                                <Input id="movement_date" type="date" value={form.data.movement_date} onChange={(event) => form.setData('movement_date', event.target.value)} />
                                <InputError message={form.errors.movement_date} />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor="reason">Reason</Label>
                                <Input id="reason" value={form.data.reason} onChange={(event) => form.setData('reason', event.target.value)} />
                                <InputError message={form.errors.reason} />
                            </div>
                        </CardContent>
                    </Card>
                    <div>
                        <Button type="submit" disabled={form.processing}>Save adjustment</Button>
                    </div>
                </form>
            </div>
        </>
    );
}
