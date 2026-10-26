import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store, update } from '@/routes/crops';

export type CropFarmOption = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_type: string;
    crop_label: string;
};

export type CropStatusOption = {
    value: string;
    label: string;
};

type CropFormValues = {
    farm_id: string;
    crop_type: string;
    variety: string;
    area_hectares: string;
    planted_on: string;
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

export function CropForm({
    mode,
    farms,
    farm,
    cropId,
    statuses,
    initial,
}: {
    mode: 'create' | 'edit';
    farms?: CropFarmOption[];
    farm?: CropFarmOption;
    cropId?: number;
    statuses: CropStatusOption[];
    initial: CropFormValues;
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
        form.put(update.url(cropId ?? 0));
    }

    return (
        <form onSubmit={submit} className="grid gap-4">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Crop record</CardTitle>
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
                                        crop_type: match?.crop_type ?? '',
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
                                {farm?.farmer_name}. This crop record stays on
                                the same farm.
                            </p>
                        </div>
                    )}

                    <Field
                        label="Crop"
                        htmlFor="crop_type"
                        required
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
                            <option value="">Select crop</option>
                            {selectedFarm && (
                                <option value={selectedFarm.crop_type}>
                                    {selectedFarm.crop_label}
                                </option>
                            )}
                        </select>
                    </Field>

                    <Field
                        label="Variety"
                        htmlFor="variety"
                        error={form.errors.variety}
                    >
                        <Input
                            id="variety"
                            value={form.data.variety}
                            onChange={(event) =>
                                form.setData('variety', event.target.value)
                            }
                            placeholder="Typica"
                        />
                    </Field>

                    <Field
                        label="Planted area (ha)"
                        htmlFor="area_hectares"
                        error={form.errors.area_hectares}
                    >
                        <Input
                            id="area_hectares"
                            inputMode="decimal"
                            value={form.data.area_hectares}
                            onChange={(event) =>
                                form.setData(
                                    'area_hectares',
                                    event.target.value,
                                )
                            }
                            placeholder="1.25"
                        />
                    </Field>

                    <Field
                        label="Planted date"
                        htmlFor="planted_on"
                        error={form.errors.planted_on}
                    >
                        <Input
                            id="planted_on"
                            type="date"
                            value={form.data.planted_on}
                            onChange={(event) =>
                                form.setData('planted_on', event.target.value)
                            }
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
                    {mode === 'create' ? 'Save crop record' : 'Save changes'}
                </Button>
            </div>
        </form>
    );
}
