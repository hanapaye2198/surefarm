import { Head, Link, setLayoutProps, useForm, usePage } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateFarmerDetails } from '@/lib/validate-farmer-form';
import { edit, index as farmersIndex, show, update } from '@/routes/farmers';

type FarmerDetails = {
    id: number;
    farmer_id: string;
    full_name: string;
    date_of_birth: string;
    government_id: string;
    has_bank_account: boolean;
    bank_name: string;
    account_number: string;
    account_name: string;
    bank_account_status: string;
};

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

export default function EditFarmerDetails({
    farmer,
}: {
    farmer: FarmerDetails;
}) {
    const pageErrors = usePage().props.errors as Record<string, string> | undefined;

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Farmers',
                href: farmersIndex(),
            },
            {
                title: farmer.full_name,
                href: show(farmer.id),
            },
            {
                title: 'Edit details',
                href: edit(farmer.id),
            },
        ],
    });

    const form = useForm({
        date_of_birth: farmer.date_of_birth,
        government_id: farmer.government_id,
        has_bank_account: farmer.has_bank_account,
        bank_name: farmer.bank_name,
        account_number: farmer.account_number,
        account_name: farmer.account_name,
        bank_account_status: farmer.bank_account_status,
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const clientErrors = validateFarmerDetails(form.data);

        if (Object.keys(clientErrors).length > 0) {
            form.setError(clientErrors);

            return;
        }

        form.clearErrors();
        form.transform((data) => ({
            ...data,
            has_bank_account: data.has_bank_account ? 1 : 0,
        }));
        form.put(update.url(farmer.id));
    }

    return (
        <>
            <Head title={`Edit ${farmer.full_name}`} />
            <form
                onSubmit={submit}
                className="flex flex-col gap-5 sm:gap-6"
                noValidate
            >
                <PageHeader
                    title="Farmer details"
                    description={`${farmer.full_name} · ${farmer.farmer_id}`}
                />

                <InputError message={pageErrors?.farmer} />

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Personal information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field
                            label="Date of Birth"
                            htmlFor="date_of_birth"
                            error={form.errors.date_of_birth}
                        >
                            <Input
                                id="date_of_birth"
                                type="date"
                                value={form.data.date_of_birth}
                                onChange={(event) =>
                                    form.setData(
                                        'date_of_birth',
                                        event.target.value,
                                    )
                                }
                            />
                        </Field>
                        <Field
                            label="Government ID"
                            htmlFor="government_id"
                            error={form.errors.government_id}
                        >
                            <Input
                                id="government_id"
                                value={form.data.government_id}
                                onChange={(event) =>
                                    form.setData(
                                        'government_id',
                                        event.target.value,
                                    )
                                }
                                placeholder="PhilSys, driver's license, or other ID"
                            />
                        </Field>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Bank account</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={form.data.has_bank_account}
                                onCheckedChange={(checked) =>
                                    form.setData(
                                        'has_bank_account',
                                        checked === true,
                                    )
                                }
                            />
                            Link a bank account
                        </label>
                        <p className="text-sm text-muted-foreground">
                            The profile shows only the last four digits of the
                            account number.
                        </p>
                        {form.data.has_bank_account && (
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field
                                    label="Bank Name"
                                    htmlFor="bank_name"
                                    required
                                    error={form.errors.bank_name}
                                >
                                    <Input
                                        id="bank_name"
                                        value={form.data.bank_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'bank_name',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="LANDBANK"
                                    />
                                </Field>
                                <Field
                                    label="Account Number"
                                    htmlFor="account_number"
                                    required
                                    error={form.errors.account_number}
                                >
                                    <Input
                                        id="account_number"
                                        value={form.data.account_number}
                                        onChange={(event) =>
                                            form.setData(
                                                'account_number',
                                                event.target.value,
                                            )
                                        }
                                        inputMode="numeric"
                                        autoComplete="off"
                                    />
                                </Field>
                                <Field
                                    label="Account Name"
                                    htmlFor="account_name"
                                    required
                                    error={form.errors.account_name}
                                >
                                    <Input
                                        id="account_name"
                                        value={form.data.account_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'account_name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Status"
                                    htmlFor="bank_account_status"
                                    error={form.errors.bank_account_status}
                                >
                                    <select
                                        id="bank_account_status"
                                        value={form.data.bank_account_status}
                                        onChange={(event) =>
                                            form.setData(
                                                'bank_account_status',
                                                event.target.value,
                                            )
                                        }
                                        className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                    >
                                        <option value="unverified">
                                            Unverified
                                        </option>
                                        <option value="verified">
                                            Verified
                                        </option>
                                    </select>
                                </Field>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" asChild>
                        <Link href={show(farmer.id)}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Saving...' : 'Save details'}
                    </Button>
                </div>
            </form>
        </>
    );
}

EditFarmerDetails.layout = {
    breadcrumbs: [
        {
            title: 'Farmers',
            href: farmersIndex(),
        },
    ],
};
