import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store, update } from '@/routes/farms/financing';

export type FinancingFarm = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
};

export type FinancingTypeOption = {
    value: string;
    label: string;
};

type FinancingFormValues = {
    amount: string;
    date_granted: string;
    loan_balance: string;
    financing_type: string;
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

export function FarmFinancingForm({
    mode,
    farm,
    financingTypes,
    financingId,
    values,
}: {
    mode: 'create' | 'edit';
    farm: FinancingFarm;
    financingTypes: FinancingTypeOption[];
    financingId?: number;
    values?: FinancingFormValues;
}) {
    const form = useForm<FinancingFormValues>({
        amount: values?.amount ?? '',
        date_granted: values?.date_granted ?? '',
        loan_balance: values?.loan_balance ?? '',
        financing_type:
            values?.financing_type ?? financingTypes[0]?.value ?? 'mm',
    });

    function submit(event: FormEvent) {
        event.preventDefault();

        if (mode === 'create') {
            form.post(store.url(farm.id));

            return;
        }

        form.put(update.url({ farm: farm.id, financing: financingId ?? 0 }));
    }

    return (
        <form onSubmit={submit} className="grid gap-4">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Financing</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                        {farm.farm_name} · {farm.farm_id} · {farm.farmer_name}
                    </p>
                    <Field
                        label="Financing Amount (PHP)"
                        htmlFor="amount"
                        required
                        error={form.errors.amount}
                    >
                        <Input
                            id="amount"
                            inputMode="decimal"
                            value={form.data.amount}
                            onChange={(event) =>
                                form.setData('amount', event.target.value)
                            }
                        />
                    </Field>
                    <Field
                        label="Date Granted"
                        htmlFor="date_granted"
                        required
                        error={form.errors.date_granted}
                    >
                        <Input
                            id="date_granted"
                            type="date"
                            value={form.data.date_granted}
                            onChange={(event) =>
                                form.setData('date_granted', event.target.value)
                            }
                        />
                    </Field>
                    <Field
                        label="Loan Balance (PHP)"
                        htmlFor="loan_balance"
                        required
                        error={form.errors.loan_balance}
                    >
                        <Input
                            id="loan_balance"
                            inputMode="decimal"
                            value={form.data.loan_balance}
                            onChange={(event) =>
                                form.setData('loan_balance', event.target.value)
                            }
                        />
                    </Field>
                    <Field
                        label="Financing Type"
                        htmlFor="financing_type"
                        required
                        error={form.errors.financing_type}
                    >
                        <select
                            id="financing_type"
                            className={selectClassName}
                            value={form.data.financing_type}
                            onChange={(event) =>
                                form.setData(
                                    'financing_type',
                                    event.target.value,
                                )
                            }
                        >
                            {financingTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                </CardContent>
            </Card>
            <div>
                <Button type="submit" disabled={form.processing}>
                    {mode === 'create' ? 'Save financing' : 'Update financing'}
                </Button>
            </div>
        </form>
    );
}
