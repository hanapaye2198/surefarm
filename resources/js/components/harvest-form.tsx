import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store, update } from '@/routes/harvest';

export type HarvestFarmOption = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_type: string;
    crop_label: string;
};

export type ProductionOption = {
    id: number;
    farm_id: number;
    label: string;
    crop_type: string | null;
    unit: string;
};

export type StatusOption = {
    value: string;
    label: string;
};

type HarvestFormValues = {
    farm_id: string;
    crop_type: string;
    production_id: string;
    harvest_date: string;
    quantity: string;
    unit: string;
    quality_grade: string;
    status: string;
    notes: string;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function Field({
    label,
    htmlFor,
    required = false,
    error,
    children,
}: {
    label: string;
    htmlFor: string;
    required?: boolean;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={htmlFor}>
                {label}
                {required && (
                    <span className="text-destructive" aria-hidden="true">
                        {' '}
                        *
                    </span>
                )}
            </Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

export function HarvestForm({
    mode,
    farms,
    farm,
    harvestId,
    productions,
    statuses,
    units,
    initial,
    productionLabel,
}: {
    mode: 'create' | 'edit';
    farms?: HarvestFarmOption[];
    farm?: HarvestFarmOption;
    harvestId?: number;
    productions?: ProductionOption[];
    statuses: StatusOption[];
    units: string[];
    initial: HarvestFormValues;
    productionLabel?: string | null;
}) {
    const form = useForm(initial);
    const [selectedFarmId, setSelectedFarmId] = useState(initial.farm_id);

    const selectedFarm =
        mode === 'edit'
            ? farm
            : farms?.find((item) => String(item.id) === selectedFarmId);

    const farmProductions =
        productions?.filter(
            (item) => String(item.farm_id) === selectedFarmId,
        ) ?? [];

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (mode === 'create') {
            form.post(store.url());

            return;
        }

        form.transform((data) => ({
            harvest_date: data.harvest_date,
            quantity: data.quantity,
            unit: data.unit,
            quality_grade: data.quality_grade,
            status: data.status,
            notes: data.notes,
        }));
        form.put(update.url(harvestId ?? 0));
    }

    return (
        <form onSubmit={submit} className="grid gap-4">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Harvest</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    {mode === 'create' ? (
                        <Field
                            label="Farm"
                            htmlFor="farm_id"
                            required
                            error={form.errors.farm_id}
                        >
                            <select
                                id="farm_id"
                                value={form.data.farm_id}
                                onChange={(event) => {
                                    const nextFarm = event.target.value;
                                    const match = farms?.find(
                                        (item) => String(item.id) === nextFarm,
                                    );

                                    setSelectedFarmId(nextFarm);
                                    form.setData({
                                        ...form.data,
                                        farm_id: nextFarm,
                                        crop_type:
                                            match &&
                                            form.data.crop_type ===
                                                match.crop_type
                                                ? form.data.crop_type
                                                : '',
                                        production_id: '',
                                    });
                                }}
                                className={selectClassName}
                            >
                                <option value="">Select farm</option>
                                {farms?.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.farm_name} · {item.farm_id}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    ) : (
                        <div className="grid gap-1 sm:col-span-2">
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Farm
                            </p>
                            <p className="text-sm">
                                {farm?.farm_name} · {farm?.farm_id}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {farm?.farmer_name}
                                {farm ? ` · ${farm.crop_label}` : ''}. The farm
                                and original record stay in place.
                            </p>
                        </div>
                    )}

                    {mode === 'create' ? (
                        <>
                            <Field
                                label="Crop"
                                htmlFor="crop_type"
                                error={form.errors.crop_type}
                            >
                                <select
                                    id="crop_type"
                                    value={form.data.crop_type}
                                    onChange={(event) =>
                                        form.setData(
                                            'crop_type',
                                            event.target.value,
                                        )
                                    }
                                    className={selectClassName}
                                    disabled={!selectedFarm}
                                >
                                    <option value="">Farm-wide</option>
                                    {selectedFarm && (
                                        <option value={selectedFarm.crop_type}>
                                            {selectedFarm.crop_label}
                                        </option>
                                    )}
                                </select>
                            </Field>
                            <Field
                                label="Production record"
                                htmlFor="production_id"
                                error={form.errors.production_id}
                            >
                                <select
                                    id="production_id"
                                    value={form.data.production_id}
                                    onChange={(event) => {
                                        const nextId = event.target.value;
                                        const match = farmProductions.find(
                                            (item) => String(item.id) === nextId,
                                        );

                                        form.setData({
                                            ...form.data,
                                            production_id: nextId,
                                            crop_type:
                                                match?.crop_type ??
                                                form.data.crop_type,
                                            unit: match?.unit ?? form.data.unit,
                                        });
                                    }}
                                    className={selectClassName}
                                    disabled={!selectedFarm}
                                >
                                    <option value="">No production record</option>
                                    {farmProductions.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </>
                    ) : (
                        productionLabel && (
                            <div className="grid gap-1 sm:col-span-2">
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Production record
                                </p>
                                <p className="text-sm">{productionLabel}</p>
                            </div>
                        )
                    )}

                    <Field
                        label="Harvest date"
                        htmlFor="harvest_date"
                        required
                        error={form.errors.harvest_date}
                    >
                        <Input
                            id="harvest_date"
                            type="date"
                            value={form.data.harvest_date}
                            onChange={(event) =>
                                form.setData('harvest_date', event.target.value)
                            }
                        />
                    </Field>

                    <Field
                        label="Quantity"
                        htmlFor="quantity"
                        required
                        error={form.errors.quantity}
                    >
                        <Input
                            id="quantity"
                            inputMode="decimal"
                            value={form.data.quantity}
                            onChange={(event) =>
                                form.setData('quantity', event.target.value)
                            }
                            placeholder="300"
                        />
                    </Field>

                    <Field
                        label="Unit"
                        htmlFor="unit"
                        required
                        error={form.errors.unit}
                    >
                        <select
                            id="unit"
                            value={form.data.unit}
                            onChange={(event) =>
                                form.setData('unit', event.target.value)
                            }
                            className={selectClassName}
                        >
                            {units.map((unit) => (
                                <option key={unit} value={unit}>
                                    {unit}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label="Quality grade"
                        htmlFor="quality_grade"
                        error={form.errors.quality_grade}
                    >
                        <Input
                            id="quality_grade"
                            value={form.data.quality_grade}
                            onChange={(event) =>
                                form.setData(
                                    'quality_grade',
                                    event.target.value,
                                )
                            }
                            placeholder="Grade A"
                        />
                    </Field>

                    <Field
                        label="Status"
                        htmlFor="status"
                        required
                        error={form.errors.status}
                    >
                        <select
                            id="status"
                            value={form.data.status}
                            onChange={(event) =>
                                form.setData('status', event.target.value)
                            }
                            className={selectClassName}
                        >
                            {statuses.map((status) => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Notes" htmlFor="notes" error={form.errors.notes}>
                        <Input
                            id="notes"
                            value={form.data.notes}
                            onChange={(event) =>
                                form.setData('notes', event.target.value)
                            }
                        />
                    </Field>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={form.processing}>
                    {mode === 'create' ? 'Save harvest' : 'Save changes'}
                </Button>
            </div>
        </form>
    );
}
