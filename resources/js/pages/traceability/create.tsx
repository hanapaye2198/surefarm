import { Head, Link, useForm } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { index, store } from '@/routes/traceability';

type Source = {
    id: number;
    label: string;
    quantity: number;
    unit: string;
    farmer: string | null;
    farm: string | null;
    crop: string | null;
    harvest: string | null;
    stage: string | null;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function display(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : '—';
}

export default function CreateTraceabilityLot({
    inventories,
    selected_inventory_id,
    units,
}: {
    inventories: Source[];
    selected_inventory_id: number | null;
    units: string[];
}) {
    const initial = inventories.find((item) => item.id === selected_inventory_id) ?? inventories[0] ?? null;
    const form = useForm({
        inventory_id: initial?.id ?? 0,
        quantity: initial ? String(initial.quantity) : '',
        unit: initial?.unit ?? 'kg',
        notes: '',
    });

    const selected = inventories.find((item) => item.id === form.data.inventory_id) ?? null;

    function choose(id: string) {
        const next = inventories.find((item) => item.id === Number(id));
        form.setData({
            inventory_id: Number(id),
            quantity: next ? String(next.quantity) : '',
            unit: next?.unit ?? form.data.unit,
            notes: form.data.notes,
        });
    }

    return (
        <>
            <Head title="Create Traceability Lot" />
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                <PageHeader
                    title="Create Traceability Lot"
                    description="The lot keeps the farmer, farm, harvest, and processing history of the selected inventory."
                />

                <form
                    className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(store.url());
                    }}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="inventory_id">Source inventory</Label>
                        <select
                            id="inventory_id"
                            className={selectClassName}
                            value={String(form.data.inventory_id)}
                            onChange={(event) => choose(event.target.value)}
                        >
                            {inventories.length === 0 && <option value="">No green bean inventory</option>}
                            {inventories.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                        </select>
                        {form.errors.inventory_id && <p className="text-sm text-destructive">{form.errors.inventory_id}</p>}
                    </div>

                    <dl className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Farmer</dt>
                            <dd className="text-sm">{display(selected?.farmer)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Farm</dt>
                            <dd className="text-sm">{display(selected?.farm)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Crop</dt>
                            <dd className="text-sm">{display(selected?.crop)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Harvest</dt>
                            <dd className="text-sm">{display(selected?.harvest)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Processing stage</dt>
                            <dd className="text-sm">{display(selected?.stage)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Available quantity</dt>
                            <dd className="text-sm tabular-nums">{selected ? `${selected.quantity} ${selected.unit}` : '—'}</dd>
                        </div>
                    </dl>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input id="quantity" inputMode="decimal" value={form.data.quantity} onChange={(event) => form.setData('quantity', event.target.value)} />
                            {form.errors.quantity && <p className="text-sm text-destructive">{form.errors.quantity}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="unit">Unit</Label>
                            <select id="unit" className={selectClassName} value={form.data.unit} onChange={(event) => form.setData('unit', event.target.value)}>
                                {units.map((unit) => (
                                    <option key={unit} value={unit}>{unit}</option>
                                ))}
                            </select>
                            {form.errors.unit && <p className="text-sm text-destructive">{form.errors.unit}</p>}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <textarea id="notes" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} className="border-input min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
                        {form.errors.notes && <p className="text-sm text-destructive">{form.errors.notes}</p>}
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link href={index()}>Back to traceability</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing || inventories.length === 0}>Create lot</Button>
                    </div>
                </form>
            </div>
        </>
    );
}
