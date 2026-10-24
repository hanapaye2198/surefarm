import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store, update } from '@/routes/farms/insurance';

export type InsuranceFarm = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
};

type InsuranceFormValues = {
    covered: string;
    amount: string;
    term_months: string;
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

export function FarmInsuranceForm({
    mode,
    farm,
    insuranceId,
    values,
}: {
    mode: 'create' | 'edit';
    farm: InsuranceFarm;
    insuranceId?: number;
    values?: InsuranceFormValues;
}) {
    const form = useForm<InsuranceFormValues>({
        covered: values?.covered ?? '1',
        amount: values?.amount ?? '',
        term_months: values?.term_months ?? '',
    });

    function submit(event: FormEvent) {
        event.preventDefault();

        if (mode === 'create') {
            form.post(store.url(farm.id));

            return;
        }

        form.put(update.url({ farm: farm.id, insurance: insuranceId ?? 0 }));
    }

    return (
        <form onSubmit={submit} className="grid gap-4">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Crop Insurance</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                        {farm.farm_name} · {farm.farm_id} · {farm.farmer_name}
                    </p>
                    <Field
                        label="Crop Insurance Covered"
                        htmlFor="covered"
                        required
                        error={form.errors.covered}
                    >
                        <select
                            id="covered"
                            className={selectClassName}
                            value={form.data.covered}
                            onChange={(event) =>
                                form.setData('covered', event.target.value)
                            }
                        >
                            <option value="1">Yes</option>
                            <option value="0">No</option>
                        </select>
                    </Field>
                    {form.data.covered === '1' && (
                        <>
                            <Field
                                label="Insurance Amount (PHP)"
                                htmlFor="amount"
                                required
                                error={form.errors.amount}
                            >
                                <Input
                                    id="amount"
                                    inputMode="decimal"
                                    value={form.data.amount}
                                    onChange={(event) =>
                                        form.setData(
                                            'amount',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Insurance Term (months)"
                                htmlFor="term_months"
                                required
                                error={form.errors.term_months}
                            >
                                <Input
                                    id="term_months"
                                    inputMode="numeric"
                                    value={form.data.term_months}
                                    onChange={(event) =>
                                        form.setData(
                                            'term_months',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                        </>
                    )}
                </CardContent>
            </Card>
            <div>
                <Button type="submit" disabled={form.processing}>
                    {mode === 'create'
                        ? 'Save crop insurance'
                        : 'Update crop insurance'}
                </Button>
            </div>
        </form>
    );
}
