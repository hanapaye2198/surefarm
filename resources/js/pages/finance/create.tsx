import { Head, Link, setLayoutProps, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientToken } from '@/lib/utils';
import { index as financeIndex, store } from '@/routes/finance';

type FarmOption = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
};

type ProductionOption = { id: number; farm_id: number; label: string };
type Choice = { value: string; label: string };

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function CreateFinancing({
    farms,
    productions,
    financingTypes,
    interestMethods,
    frequencies,
    selectedFarmId,
    today,
}: {
    farms: FarmOption[];
    productions: ProductionOption[];
    financingTypes: Choice[];
    interestMethods: Choice[];
    frequencies: Choice[];
    selectedFarmId: number | null;
    today: string;
}) {
    const [token] = useState(() => clientToken());
    const form = useForm({
        farm_id: selectedFarmId ? String(selectedFarmId) : '',
        farm_production_id: '',
        financing_type: financingTypes[0]?.value ?? 'mm',
        purpose: '',
        amount: '',
        currency: 'PHP',
        interest_method: 'none',
        interest_rate: '',
        interest_amount: '0',
        fee_amount: '0',
        application_date: today,
        repayment_frequency: '',
        installment_count: '',
        due_date: '',
        maturity_date: '',
        notes: '',
        client_token: token,
    });

    setLayoutProps({
        breadcrumbs: [
            { title: 'Finance', href: financeIndex() },
            { title: 'New application', href: financeIndex() },
        ],
    });

    const farmId = Number(form.data.farm_id);
    const farmProductions = productions.filter(
        (production) => production.farm_id === farmId,
    );

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(store.url());
    }

    return (
        <>
            <Head title="New financing application" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="New financing application"
                    description="This starts review, approval, disbursement, and repayment. Interest is the amount you enter. SureFarm does not calculate a rate. A stated grant on the farm record is separate and does not create a ledger."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={financeIndex()}>Back to finance</Link>
                        </Button>
                    }
                />
                <form onSubmit={submit} className="grid gap-4">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Agreement</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label="Farm"
                                error={form.errors.farm_id}
                                required
                            >
                                <select
                                    className={selectClassName}
                                    value={form.data.farm_id}
                                    onChange={(event) =>
                                        form.setData({
                                            ...form.data,
                                            farm_id: event.target.value,
                                            farm_production_id: '',
                                        })
                                    }
                                >
                                    <option value="">Choose a farm</option>
                                    {farms.map((farm) => (
                                        <option key={farm.id} value={farm.id}>
                                            {farm.farm_name} ·{' '}
                                            {farm.farmer_name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Crop cycle"
                                error={form.errors.farm_production_id}
                            >
                                <select
                                    className={selectClassName}
                                    value={form.data.farm_production_id}
                                    onChange={(event) =>
                                        form.setData(
                                            'farm_production_id',
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">Not linked</option>
                                    {farmProductions.map((production) => (
                                        <option
                                            key={production.id}
                                            value={production.id}
                                        >
                                            {production.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Purpose"
                                error={form.errors.purpose}
                                required
                            >
                                <Input
                                    value={form.data.purpose}
                                    onChange={(event) =>
                                        form.setData(
                                            'purpose',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Type"
                                error={form.errors.financing_type}
                                required
                            >
                                <select
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
                                        <option
                                            key={type.value}
                                            value={type.value}
                                        >
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Principal"
                                error={form.errors.amount}
                                required
                            >
                                <Input
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
                                label="Currency"
                                error={form.errors.currency}
                                required
                            >
                                <Input
                                    value={form.data.currency}
                                    maxLength={3}
                                    onChange={(event) =>
                                        form.setData(
                                            'currency',
                                            event.target.value.toUpperCase(),
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Interest"
                                error={form.errors.interest_method}
                                required
                            >
                                <select
                                    className={selectClassName}
                                    value={form.data.interest_method}
                                    onChange={(event) =>
                                        form.setData(
                                            'interest_method',
                                            event.target.value,
                                        )
                                    }
                                >
                                    {interestMethods.map((method) => (
                                        <option
                                            key={method.value}
                                            value={method.value}
                                        >
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Interest amount"
                                error={form.errors.interest_amount}
                            >
                                <Input
                                    inputMode="decimal"
                                    value={form.data.interest_amount}
                                    onChange={(event) =>
                                        form.setData(
                                            'interest_amount',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Interest rate % (optional, not calculated)"
                                error={form.errors.interest_rate}
                            >
                                <Input
                                    inputMode="decimal"
                                    value={form.data.interest_rate}
                                    onChange={(event) =>
                                        form.setData(
                                            'interest_rate',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Fee amount"
                                error={form.errors.fee_amount}
                            >
                                <Input
                                    inputMode="decimal"
                                    value={form.data.fee_amount}
                                    onChange={(event) =>
                                        form.setData(
                                            'fee_amount',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Application date"
                                error={form.errors.application_date}
                                required
                            >
                                <Input
                                    type="date"
                                    value={form.data.application_date}
                                    onChange={(event) =>
                                        form.setData(
                                            'application_date',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Repayment frequency"
                                error={form.errors.repayment_frequency}
                            >
                                <select
                                    className={selectClassName}
                                    value={form.data.repayment_frequency}
                                    onChange={(event) =>
                                        form.setData(
                                            'repayment_frequency',
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">
                                        Choose before disbursement
                                    </option>
                                    {frequencies.map((frequency) => (
                                        <option
                                            key={frequency.value}
                                            value={frequency.value}
                                        >
                                            {frequency.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Installments"
                                error={form.errors.installment_count}
                            >
                                <Input
                                    inputMode="numeric"
                                    value={form.data.installment_count}
                                    onChange={(event) =>
                                        form.setData(
                                            'installment_count',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Due date"
                                error={form.errors.due_date}
                            >
                                <Input
                                    type="date"
                                    value={form.data.due_date}
                                    onChange={(event) =>
                                        form.setData(
                                            'due_date',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Maturity date"
                                error={form.errors.maturity_date}
                            >
                                <Input
                                    type="date"
                                    value={form.data.maturity_date}
                                    onChange={(event) =>
                                        form.setData(
                                            'maturity_date',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field label="Notes" error={form.errors.notes}>
                                <Input
                                    value={form.data.notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'notes',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                        </CardContent>
                    </Card>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Saving...' : 'Submit application'}
                    </Button>
                </form>
            </div>
        </>
    );
}

function Field({
    label,
    error,
    required = false,
    children,
}: {
    label: string;
    error?: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label>
                {label}
                {required ? ' *' : ''}
            </Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
