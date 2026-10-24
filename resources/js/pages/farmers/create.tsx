import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ImagePlus, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { FarmerStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateFarmerForm } from '@/lib/validate-farmer-form';
import { create, index as farmersIndex, store } from '@/routes/farmers';

type CooperativeOption = {
    id: number;
    name: string;
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

export default function CreateFarmer({
    farmerId,
    cooperatives,
}: {
    farmerId: string;
    cooperatives: CooperativeOption[];
}) {
    const pageErrors = usePage().props.errors as
        | Record<string, string>
        | undefined;
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const form = useForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        date_of_birth: '',
        government_id: '',
        purok_sitio: '',
        barangay: '',
        municipality: '',
        province: '',
        mobile_number: '',
        email: '',
        cooperative_id: '',
        has_spouse: false as boolean,
        spouse_first_name: '',
        spouse_middle_name: '',
        spouse_last_name: '',
        has_bank_account: false as boolean,
        bank_name: '',
        account_number: '',
        account_name: '',
        bank_account_status: 'unverified',
        photo: null as File | null,
    });

    function choosePhoto(file: File | null) {
        setPreviewUrl((current) => {
            if (current) {
                URL.revokeObjectURL(current);
            }

            return file ? URL.createObjectURL(file) : null;
        });
        form.setData('photo', file);
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const clientErrors = validateFarmerForm(
            {
                first_name: form.data.first_name,
                last_name: form.data.last_name,
                purok_sitio: form.data.purok_sitio,
                barangay: form.data.barangay,
                municipality: form.data.municipality,
                province: form.data.province,
                mobile_number: form.data.mobile_number,
                email: form.data.email,
                has_spouse: form.data.has_spouse,
                spouse_first_name: form.data.spouse_first_name,
                spouse_last_name: form.data.spouse_last_name,
                date_of_birth: form.data.date_of_birth,
                government_id: form.data.government_id,
                has_bank_account: form.data.has_bank_account,
                bank_name: form.data.bank_name,
                account_number: form.data.account_number,
                account_name: form.data.account_name,
            },
            form.data.photo,
        );

        if (Object.keys(clientErrors).length > 0) {
            form.setError(clientErrors);

            return;
        }

        form.clearErrors();

        form.transform((data) => {
            const payload: Record<string, unknown> = {
                ...data,
                has_spouse: data.has_spouse ? 1 : 0,
                has_bank_account: data.has_bank_account ? 1 : 0,
                cooperative_id: data.cooperative_id || null,
            };

            if (!data.photo) {
                delete payload.photo;
            }

            return payload;
        });

        form.post(store.url(), {
            forceFormData: true,
        });
    }

    return (
        <>
            <Head title="Farmer Data Capture" />
            <form
                onSubmit={submit}
                className="flex flex-col gap-5 sm:gap-6"
                noValidate
            >
                <PageHeader
                    title="Farmer Data Capture"
                    description="Register a new coffee farmer in SureFarm."
                />

                <InputError message={pageErrors?.farmer} />

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Farmer photo</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex size-28 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Farmer photo preview"
                                    className="size-full object-cover"
                                />
                            ) : (
                                <ImagePlus className="size-6 text-muted-foreground" />
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="photo">Farmer Photo</Label>
                            <Input
                                id="photo"
                                type="file"
                                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                                onChange={(event) => {
                                    choosePhoto(
                                        event.target.files?.[0] ?? null,
                                    );
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                JPG or PNG, up to 5 MB. You can use your camera
                                where the browser allows it.
                            </p>
                            {previewUrl && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => choosePhoto(null)}
                                >
                                    <X />
                                    Remove photo
                                </Button>
                            )}
                            <InputError message={form.errors.photo} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Farmer identification</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="farmer-id">Farmer ID</Label>
                            <Input
                                id="farmer-id"
                                value={farmerId}
                                readOnly
                                aria-readonly="true"
                            />
                            <p className="text-xs text-muted-foreground">
                                Assigned by SureFarm and cannot be edited. This
                                demo generator will be replaced when the
                                official security code is defined.
                            </p>
                        </div>
                        <Field
                            label="First Name"
                            htmlFor="first_name"
                            required
                            error={form.errors.first_name}
                        >
                            <Input
                                id="first_name"
                                value={form.data.first_name}
                                onChange={(event) =>
                                    form.setData(
                                        'first_name',
                                        event.target.value,
                                    )
                                }
                                autoComplete="given-name"
                            />
                        </Field>
                        <Field
                            label="Middle Name"
                            htmlFor="middle_name"
                            error={form.errors.middle_name}
                        >
                            <Input
                                id="middle_name"
                                value={form.data.middle_name}
                                onChange={(event) =>
                                    form.setData(
                                        'middle_name',
                                        event.target.value,
                                    )
                                }
                            />
                        </Field>
                        <Field
                            label="Last Name"
                            htmlFor="last_name"
                            required
                            error={form.errors.last_name}
                        >
                            <Input
                                id="last_name"
                                value={form.data.last_name}
                                onChange={(event) =>
                                    form.setData(
                                        'last_name',
                                        event.target.value,
                                    )
                                }
                                autoComplete="family-name"
                            />
                        </Field>
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
                        <CardTitle>Address</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field
                            label="Purok / Sitio"
                            htmlFor="purok_sitio"
                            required
                            error={form.errors.purok_sitio}
                        >
                            <Input
                                id="purok_sitio"
                                value={form.data.purok_sitio}
                                onChange={(event) =>
                                    form.setData(
                                        'purok_sitio',
                                        event.target.value,
                                    )
                                }
                            />
                        </Field>
                        <Field
                            label="Barangay"
                            htmlFor="barangay"
                            required
                            error={form.errors.barangay}
                        >
                            <Input
                                id="barangay"
                                value={form.data.barangay}
                                onChange={(event) =>
                                    form.setData('barangay', event.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Municipality / City"
                            htmlFor="municipality"
                            required
                            error={form.errors.municipality}
                        >
                            <Input
                                id="municipality"
                                value={form.data.municipality}
                                onChange={(event) =>
                                    form.setData(
                                        'municipality',
                                        event.target.value,
                                    )
                                }
                            />
                        </Field>
                        <Field
                            label="Province"
                            htmlFor="province"
                            required
                            error={form.errors.province}
                        >
                            <Input
                                id="province"
                                value={form.data.province}
                                onChange={(event) =>
                                    form.setData('province', event.target.value)
                                }
                            />
                        </Field>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Contact information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field
                            label="Mobile Number"
                            htmlFor="mobile_number"
                            required
                            error={form.errors.mobile_number}
                        >
                            <Input
                                id="mobile_number"
                                value={form.data.mobile_number}
                                onChange={(event) =>
                                    form.setData(
                                        'mobile_number',
                                        event.target.value,
                                    )
                                }
                                autoComplete="tel"
                            />
                        </Field>
                        <Field
                            label="Email Address"
                            htmlFor="email"
                            error={form.errors.email}
                        >
                            <Input
                                id="email"
                                type="email"
                                value={form.data.email}
                                onChange={(event) =>
                                    form.setData('email', event.target.value)
                                }
                                autoComplete="email"
                            />
                        </Field>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Cooperative / Association</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        <Label htmlFor="cooperative_id">
                            Cooperative / Association
                        </Label>
                        {cooperatives.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No cooperatives available
                            </p>
                        ) : (
                            <select
                                id="cooperative_id"
                                value={form.data.cooperative_id}
                                onChange={(event) =>
                                    form.setData(
                                        'cooperative_id',
                                        event.target.value,
                                    )
                                }
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                                <option value="">No cooperative</option>
                                {cooperatives.map((cooperative) => (
                                    <option
                                        key={cooperative.id}
                                        value={cooperative.id}
                                    >
                                        {cooperative.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <InputError message={form.errors.cooperative_id} />
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Bank account (optional)</CardTitle>
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
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Spouse information (optional)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={form.data.has_spouse}
                                onCheckedChange={(checked) =>
                                    form.setData('has_spouse', checked === true)
                                }
                            />
                            Farmer has spouse information
                        </label>
                        {form.data.has_spouse && (
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field
                                    label="First Name"
                                    htmlFor="spouse_first_name"
                                    required
                                    error={form.errors.spouse_first_name}
                                >
                                    <Input
                                        id="spouse_first_name"
                                        value={form.data.spouse_first_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'spouse_first_name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Middle Name"
                                    htmlFor="spouse_middle_name"
                                    error={form.errors.spouse_middle_name}
                                >
                                    <Input
                                        id="spouse_middle_name"
                                        value={form.data.spouse_middle_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'spouse_middle_name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Last Name"
                                    htmlFor="spouse_last_name"
                                    required
                                    error={form.errors.spouse_last_name}
                                >
                                    <Input
                                        id="spouse_last_name"
                                        value={form.data.spouse_last_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'spouse_last_name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Status</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <FarmerStatusBadge status="active" />
                        <p className="text-sm text-muted-foreground">
                            New farmers are registered as active.
                        </p>
                    </CardContent>
                </Card>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" asChild>
                        <Link href={farmersIndex()}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Registering...' : 'Register Farmer'}
                    </Button>
                </div>
            </form>
        </>
    );
}

CreateFarmer.layout = {
    breadcrumbs: [
        {
            title: 'Farmers',
            href: farmersIndex(),
        },
        {
            title: 'Farmer Data Capture',
            href: create(),
        },
    ],
};
