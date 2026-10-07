import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { processing, index as inventoryIndex } from '@/routes/inventory';
import { store } from '@/routes/inventory/process';

type Lot = {
    id: number;
    label: string;
    farm_name: string;
    farmer_name: string;
    quantity: number;
    unit: string;
    stage_name: string;
    location: string;
    next_stage_id: number;
    next_stage_name: string;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function ProcessCoffee({
    lots,
    selectedInventoryId,
    today,
}: {
    lots: Lot[];
    selectedInventoryId: number | null;
    today: string;
}) {
    const initial = lots.find((lot) => lot.id === selectedInventoryId) ?? lots[0];
    const form = useForm({
        inventory_id: initial ? String(initial.id) : '',
        input_quantity: '',
        output_quantity: '',
        destination_stage_id: initial ? String(initial.next_stage_id) : '',
        processing_date: today,
        location: initial?.location ?? '',
        notes: '',
    });

    const selected = lots.find((lot) => String(lot.id) === form.data.inventory_id) ?? null;

    function chooseLot(inventoryId: string) {
        const lot = lots.find((item) => String(item.id) === inventoryId);

        form.setData({
            ...form.data,
            inventory_id: inventoryId,
            destination_stage_id: lot ? String(lot.next_stage_id) : '',
            location: lot?.location ?? '',
        });
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(store.url());
    }

    return (
        <>
            <Head title="Process Coffee" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Process Coffee"
                    description="Record the weight that goes in and the weight that comes out. Yield is not assumed to be one to one."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={processing()}>Back to processing</Link>
                        </Button>
                    }
                />
                {lots.length === 0 ? (
                    <Card className="shadow-sm">
                        <CardContent className="text-sm text-muted-foreground">
                            No coffee is waiting for the next processing stage.
                        </CardContent>
                    </Card>
                ) : (
                    <form onSubmit={submit} className="grid gap-4">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>Stage transition</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="inventory_id">Source inventory</Label>
                                    <select id="inventory_id" className={selectClassName} value={form.data.inventory_id} onChange={(event) => chooseLot(event.target.value)}>
                                        {lots.map((lot) => (
                                            <option key={lot.id} value={lot.id}>
                                                {lot.farmer_name} · {lot.farm_name} · {lot.label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={form.errors.inventory_id} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Source stage</Label>
                                    <p className="text-sm">{selected?.stage_name ?? '—'}</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Destination stage</Label>
                                    <p className="text-sm">{selected?.next_stage_name ?? '—'}</p>
                                    <InputError message={form.errors.destination_stage_id} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="input_quantity">Input quantity ({selected?.unit ?? 'kg'})</Label>
                                    <Input id="input_quantity" inputMode="decimal" value={form.data.input_quantity} onChange={(event) => form.setData('input_quantity', event.target.value)} />
                                    <InputError message={form.errors.input_quantity} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="output_quantity">Output quantity ({selected?.unit ?? 'kg'})</Label>
                                    <Input id="output_quantity" inputMode="decimal" value={form.data.output_quantity} onChange={(event) => form.setData('output_quantity', event.target.value)} />
                                    <InputError message={form.errors.output_quantity} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="processing_date">Processing date</Label>
                                    <Input id="processing_date" type="date" value={form.data.processing_date} onChange={(event) => form.setData('processing_date', event.target.value)} />
                                    <InputError message={form.errors.processing_date} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="location">Location</Label>
                                    <Input id="location" value={form.data.location} onChange={(event) => form.setData('location', event.target.value)} />
                                    <InputError message={form.errors.location} />
                                </div>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="notes">Notes</Label>
                                    <Input id="notes" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                                    <InputError message={form.errors.notes} />
                                </div>
                            </CardContent>
                        </Card>
                        <div>
                            <Button type="submit" disabled={form.processing || selected === null}>Save processing</Button>
                        </div>
                    </form>
                )}
                <Button variant="outline" asChild className="w-fit">
                    <Link href={inventoryIndex()}>Back to inventory</Link>
                </Button>
            </div>
        </>
    );
}
