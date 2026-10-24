import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store, update } from '@/routes/production';

export type ProductionFarmOption = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_type: string;
    crop_label: string;
};

export type StatusOption = {
    value: string;
    label: string;
};

type ProductionFormValues = {
    farm_id: string;
    crop_type: string;
    production_period: string;
    expected_quantity: string;
    unit: string;
    notes: string;
    status: string;
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

export function ProductionForm({
    mode,
    farms,
    farm,
    productionId,
    statuses,
    units,
    initial,
}: {
    mode: 'create' | 'edit';
    farms?: ProductionFarmOption[];
    farm?: ProductionFarmOption;
    productionId?: number;
    statuses: StatusOption[];
    units: string[];
    initial: ProductionFormValues;
}) {
    const form = useForm(initial);
    const [selectedFarmId, setSelectedFarmId] = useState(initial.farm_id);

    const selectedFarm =
        mode === 'edit'
            ? farm
            : farms?.find((item) => String(item.id) === selectedFarmId);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (mode === 'create') {
            form.post(store.url());

            return;
        }

        form.transform((data) => {
            const { farm_id: _farmId, ...payload } = data;

            return payload;
        });
        form.put(update.url(productionId ?? 0));
    }

    return (
        <form onSubmit={submit} className="grid gap-4">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Expected production</CardTitle>
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
                                {farm?.farmer_name}. This estimate stays on the
                                same farm.
                            </p>
                        </div>
                    )}

                    <Field
                        label="Crop"
                        htmlFor="crop_type"
                        error={form.errors.crop_type}
                    >
                        <select
                            id="crop_type"
                            value={form.data.crop_type}
                            onChange={(event) =>
                                form.setData('crop_type', event.target.value)
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
                        label="Production period"
                        htmlFor="production_period"
                        error={form.errors.production_period}
                    >
                        <Input
                            id="production_period"
                            value={form.data.production_period}
                            onChange={(event) =>
                                form.setData(
                                    'production_period',
                                    event.target.value,
                                )
                            }
                            placeholder="2026 or 2026 Coffee Season"
                        />
                    </Field>

                    <Field
                        label="Expected quantity"
                        htmlFor="expected_quantity"
                        error={form.errors.expected_quantity}
                    >
                        <Input
                            id="expected_quantity"
                            inputMode="decimal"
                            value={form.data.expected_quantity}
                            onChange={(event) =>
                                form.setData(
                                    'expected_quantity',
                                    event.target.value,
                                )
                            }
                            placeholder="1200"
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

                    <Field
                        label="Notes"
                        htmlFor="notes"
                        error={form.errors.notes}
                    >
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
                    {mode === 'create' ? 'Save production' : 'Save changes'}
                </Button>
            </div>
        </form>
    );
}
