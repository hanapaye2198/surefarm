import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store, update } from '@/routes/farm-activities';

export type ActivityFarmOption = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    crop_type: string;
    crop_label: string;
};

export type ActivityOption = {
    id: number;
    name: string;
    category: string | null;
};

export type StatusOption = {
    value: string;
    label: string;
};

type ActivityFormValues = {
    farm_id: string;
    activity_type_id: string;
    crop_type: string;
    activity_date: string;
    status: string;
    description: string;
    performed_by: string;
    quantity: string;
    unit: string;
    cost_amount: string;
    remarks: string;
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

export function FarmActivityForm({
    mode,
    farms,
    farm,
    activityId,
    activityTypes,
    statuses,
    initial,
}: {
    mode: 'create' | 'edit';
    farms?: ActivityFarmOption[];
    farm?: ActivityFarmOption;
    activityId?: number;
    activityTypes: ActivityOption[];
    statuses: StatusOption[];
    initial: ActivityFormValues;
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
        form.put(update.url(activityId ?? 0));
    }

    return (
        <form onSubmit={submit} className="grid gap-4">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Activity</CardTitle>
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
                                {farm?.farmer_name}. The farm on this record
                                stays the same.
                            </p>
                        </div>
                    )}

                    <Field
                        label="Activity Type"
                        htmlFor="activity_type_id"
                        required
                        error={form.errors.activity_type_id}
                    >
                        <select
                            id="activity_type_id"
                            value={form.data.activity_type_id}
                            onChange={(event) =>
                                form.setData(
                                    'activity_type_id',
                                    event.target.value,
                                )
                            }
                            className={selectClassName}
                        >
                            <option value="">Select activity type</option>
                            {activityTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>
                    </Field>

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
                            disabled={selectedFarm === undefined}
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
                        label="Activity Date"
                        htmlFor="activity_date"
                        required
                        error={form.errors.activity_date}
                    >
                        <Input
                            id="activity_date"
                            type="date"
                            value={form.data.activity_date}
                            onChange={(event) =>
                                form.setData(
                                    'activity_date',
                                    event.target.value,
                                )
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

                    <div className="sm:col-span-2">
                        <Field
                            label="Description"
                            htmlFor="description"
                            error={form.errors.description}
                        >
                            <textarea
                                id="description"
                                value={form.data.description}
                                onChange={(event) =>
                                    form.setData(
                                        'description',
                                        event.target.value,
                                    )
                                }
                                rows={3}
                                maxLength={500}
                                placeholder="Applied organic fertilizer to the coffee plots."
                                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                        </Field>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Work and cost</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Performed By"
                        htmlFor="performed_by"
                        error={form.errors.performed_by}
                    >
                        <Input
                            id="performed_by"
                            value={form.data.performed_by}
                            onChange={(event) =>
                                form.setData('performed_by', event.target.value)
                            }
                            maxLength={255}
                        />
                    </Field>
                    <Field
                        label="Quantity"
                        htmlFor="quantity"
                        error={form.errors.quantity}
                    >
                        <Input
                            id="quantity"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.data.quantity}
                            onChange={(event) =>
                                form.setData('quantity', event.target.value)
                            }
                        />
                    </Field>
                    <Field label="Unit" htmlFor="unit" error={form.errors.unit}>
                        <Input
                            id="unit"
                            value={form.data.unit}
                            onChange={(event) =>
                                form.setData('unit', event.target.value)
                            }
                            maxLength={32}
                            placeholder="kg, bags, liters"
                        />
                    </Field>
                    <Field
                        label="Cost"
                        htmlFor="cost_amount"
                        error={form.errors.cost_amount}
                    >
                        <Input
                            id="cost_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.data.cost_amount}
                            onChange={(event) =>
                                form.setData('cost_amount', event.target.value)
                            }
                        />
                    </Field>
                    <div className="sm:col-span-2">
                        <Field
                            label="Remarks"
                            htmlFor="remarks"
                            error={form.errors.remarks}
                        >
                            <textarea
                                id="remarks"
                                value={form.data.remarks}
                                onChange={(event) =>
                                    form.setData('remarks', event.target.value)
                                }
                                rows={2}
                                maxLength={1000}
                                placeholder="Rain expected tomorrow."
                                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                        </Field>
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                        Cost is an operational reference. It is not posted to
                        finance. Saving this activity does not change the farm
                        stage, declared area, or verification.
                    </p>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={form.processing}>
                    {mode === 'create' ? 'Save activity' : 'Save changes'}
                </Button>
            </div>
        </form>
    );
}
