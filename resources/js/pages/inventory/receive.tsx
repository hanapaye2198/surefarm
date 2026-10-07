import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { show as showHarvest } from '@/routes/harvest';
import { store } from '@/routes/harvest/receive';

type HarvestRecord = {
    id: number;
    quantity_label: string;
    quantity: number;
    unit: string;
    crop_label: string;
    farm: { farm_name: string } | null;
    farmer: { name: string } | null;
};

type Stage = { id: number; name: string; code: string };

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function ReceiveHarvest({
    harvest,
    remaining,
    stages,
    units,
    today,
}: {
    harvest: HarvestRecord;
    remaining: number;
    stages: Stage[];
    units: string[];
    today: string;
}) {
    const cherry =
        stages.find((stage) => stage.code === 'COFFEE_CHERRY') ?? stages[0];
    const form = useForm({
        quantity: remaining > 0 ? String(remaining) : '',
        unit: harvest.unit,
        processing_stage_id: cherry ? String(cherry.id) : '',
        location: 'Farm Storage',
        received_date: today,
        notes: '',
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(store.url(harvest.id));
    }

    return (
        <>
            <Head title="Receive into Inventory" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Receive into Inventory"
                    description={`${harvest.farm?.farm_name ?? 'Farm'} · ${harvest.quantity_label} ${harvest.crop_label}`}
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={showHarvest(harvest.id)}>
                                Back to harvest
                            </Link>
                        </Button>
                    }
                />
                <form onSubmit={submit} className="grid gap-4">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Receipt</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <p className="text-sm text-muted-foreground sm:col-span-2">
                                {harvest.farmer?.name ?? 'Farmer'} · {remaining}{' '}
                                {harvest.unit} not yet received. The harvest
                                quantity stays {harvest.quantity_label}.
                            </p>
                            <div className="grid gap-2">
                                <Label htmlFor="quantity">Quantity</Label>
                                <Input
                                    id="quantity"
                                    inputMode="decimal"
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
                                <Label htmlFor="unit">Unit</Label>
                                <select
                                    id="unit"
                                    className={selectClassName}
                                    value={form.data.unit}
                                    onChange={(event) =>
                                        form.setData('unit', event.target.value)
                                    }
                                >
                                    {units.map((unit) => (
                                        <option key={unit} value={unit}>
                                            {unit}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.unit} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="processing_stage_id">
                                    Processing stage
                                </Label>
                                <select
                                    id="processing_stage_id"
                                    className={selectClassName}
                                    value={form.data.processing_stage_id}
                                    onChange={(event) =>
                                        form.setData(
                                            'processing_stage_id',
                                            event.target.value,
                                        )
                                    }
                                >
                                    {stages.map((stage) => (
                                        <option key={stage.id} value={stage.id}>
                                            {stage.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={form.errors.processing_stage_id}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="location">Location</Label>
                                <Input
                                    id="location"
                                    value={form.data.location}
                                    onChange={(event) =>
                                        form.setData(
                                            'location',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.location} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="received_date">
                                    Received date
                                </Label>
                                <Input
                                    id="received_date"
                                    type="date"
                                    value={form.data.received_date}
                                    onChange={(event) =>
                                        form.setData(
                                            'received_date',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={form.errors.received_date}
                                />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Input
                                    id="notes"
                                    value={form.data.notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'notes',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.notes} />
                            </div>
                        </CardContent>
                    </Card>
                    <div>
                        <Button type="submit" disabled={form.processing}>
                            Save inventory
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}
