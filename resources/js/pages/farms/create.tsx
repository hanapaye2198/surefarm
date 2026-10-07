import { Head, Link, setLayoutProps, useForm, usePage } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateFarmForm } from '@/lib/validate-farm-form';
import { index as farmersIndex, show as showFarmer } from '@/routes/farmers';
import { create, store } from '@/routes/farmers/farms';

type CropOption = {
    value: string;
    label: string;
};

type FarmerContext = {
    id: number;
    farmer_id: string;
    full_name: string;
    purok_sitio: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
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

export default function RegisterFarm({
    farmId,
    farmer,
    cropTypes,
    stages,
    ownerships,
}: {
    farmId: string;
    farmer: FarmerContext;
    cropTypes: CropOption[];
    stages: CropOption[];
    ownerships: CropOption[];
}) {
    const pageErrors = usePage().props.errors as
        | Record<string, string>
        | undefined;
    const form = useForm({
        farm_name: '',
        crop_type: '',
        declared_area_hectares: '',
        purok_sitio: farmer.purok_sitio ?? '',
        barangay: farmer.barangay ?? '',
        municipality: farmer.municipality ?? '',
        province: farmer.province ?? '',
        latitude: '',
        longitude: '',
        notes: '',
        current_stage: '',
        number_of_hills: '',
        data_validated: '',
        property_ownership: '',
        contracted_value_estimated: '',
        input_support_amount: '',
        financing_support_amount: '',
        drone_image: null as File | null,
    });

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Farmers',
                href: farmersIndex(),
            },
            {
                title: farmer.full_name,
                href: showFarmer(farmer.id),
            },
            {
                title: 'Register Farm',
                href: create(farmer.id),
            },
        ],
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const clientErrors = validateFarmForm({
            crop_type: form.data.crop_type,
            declared_area_hectares: form.data.declared_area_hectares,
            latitude: form.data.latitude,
            longitude: form.data.longitude,
            number_of_hills: form.data.number_of_hills,
            contracted_value_estimated: form.data.contracted_value_estimated,
            input_support_amount: form.data.input_support_amount,
            financing_support_amount: form.data.financing_support_amount,
        });

        if (Object.keys(clientErrors).length > 0) {
            form.setError(clientErrors);

            return;
        }

        form.clearErrors();
        form.transform((data) => {
            const payload: Record<string, unknown> = { ...data };

            if (!data.drone_image) {
                delete payload.drone_image;
            }

            return payload;
        });
        form.post(store.url(farmer.id), {
            forceFormData: form.data.drone_image !== null,
        });
    }

    return (
        <>
            <Head title="Register Farm" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Register Farm"
                    description="Add a farm under this farmer's profile."
                />

                <Card className="shadow-none">
                    <CardContent className="grid gap-1 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Farmer
                            </p>
                            <p className="text-sm font-medium">
                                {farmer.full_name}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Farmer ID
                            </p>
                            <p className="text-sm font-medium">
                                {farmer.farmer_id}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <form onSubmit={submit} noValidate className="flex flex-col gap-6">
                    <InputError message={pageErrors?.farm} />

                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Farm information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <Field label="Farm ID" htmlFor="farm-id">
                                <Input
                                    id="farm-id"
                                    value={farmId}
                                    readOnly
                                    aria-readonly="true"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Assigned by SureFarm when the farm is
                                    saved. This demo sequence can be replaced
                                    if an official farm ID scheme is defined.
                                </p>
                            </Field>
                            <Field
                                label="Farm Name"
                                htmlFor="farm_name"
                                error={form.errors.farm_name}
                            >
                                <Input
                                    id="farm_name"
                                    value={form.data.farm_name}
                                    onChange={(event) =>
                                        form.setData(
                                            'farm_name',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Crop Type"
                                htmlFor="crop_type"
                                required
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
                                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    <option value="">Select crop type</option>
                                    {cropTypes.map((crop) => (
                                        <option
                                            key={crop.value}
                                            value={crop.value}
                                        >
                                            {crop.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Declared Farm Area (hectares)"
                                htmlFor="declared_area_hectares"
                                required
                                error={form.errors.declared_area_hectares}
                            >
                                <Input
                                    id="declared_area_hectares"
                                    inputMode="decimal"
                                    value={form.data.declared_area_hectares}
                                    onChange={(event) =>
                                        form.setData(
                                            'declared_area_hectares',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                        </CardContent>
                    </Card>

                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Farm location</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <Field
                                label="Purok / Sitio"
                                htmlFor="purok_sitio"
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
                                error={form.errors.barangay}
                            >
                                <Input
                                    id="barangay"
                                    value={form.data.barangay}
                                    onChange={(event) =>
                                        form.setData(
                                            'barangay',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Municipality / City"
                                htmlFor="municipality"
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
                                error={form.errors.province}
                            >
                                <Input
                                    id="province"
                                    value={form.data.province}
                                    onChange={(event) =>
                                        form.setData(
                                            'province',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Latitude"
                                htmlFor="latitude"
                                error={form.errors.latitude}
                            >
                                <Input
                                    id="latitude"
                                    inputMode="decimal"
                                    value={form.data.latitude}
                                    onChange={(event) =>
                                        form.setData(
                                            'latitude',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Longitude"
                                htmlFor="longitude"
                                error={form.errors.longitude}
                            >
                                <Input
                                    id="longitude"
                                    inputMode="decimal"
                                    value={form.data.longitude}
                                    onChange={(event) =>
                                        form.setData(
                                            'longitude',
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                        </CardContent>
                    </Card>

                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Farm reference</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <Field label="Current Stage" htmlFor="current_stage" error={form.errors.current_stage}>
                                <select
                                    id="current_stage"
                                    value={form.data.current_stage}
                                    onChange={(event) =>
                                        form.setData('current_stage', event.target.value)
                                    }
                                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none"
                                >
                                    <option value="">Not provided</option>
                                    {stages.map((stage) => (
                                        <option key={stage.value} value={stage.value}>
                                            {stage.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Property Ownership" htmlFor="property_ownership" error={form.errors.property_ownership}>
                                <select
                                    id="property_ownership"
                                    value={form.data.property_ownership}
                                    onChange={(event) =>
                                        form.setData('property_ownership', event.target.value)
                                    }
                                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none"
                                >
                                    <option value="">Not provided</option>
                                    {ownerships.map((ownership) => (
                                        <option key={ownership.value} value={ownership.value}>
                                            {ownership.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="No. of Hills" htmlFor="number_of_hills" error={form.errors.number_of_hills}>
                                <Input
                                    id="number_of_hills"
                                    inputMode="numeric"
                                    value={form.data.number_of_hills}
                                    onChange={(event) =>
                                        form.setData('number_of_hills', event.target.value)
                                    }
                                />
                            </Field>
                            <Field label="Data validation" htmlFor="data_validated" error={form.errors.data_validated}>
                                <select
                                    id="data_validated"
                                    value={form.data.data_validated}
                                    onChange={(event) =>
                                        form.setData('data_validated', event.target.value)
                                    }
                                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none"
                                >
                                    <option value="">Not provided</option>
                                    <option value="1">Yes</option>
                                    <option value="0">No</option>
                                </select>
                            </Field>
                            <Field label="Contracted Value (PHP)" htmlFor="contracted_value_estimated" error={form.errors.contracted_value_estimated}>
                                <Input
                                    id="contracted_value_estimated"
                                    inputMode="decimal"
                                    value={form.data.contracted_value_estimated}
                                    onChange={(event) =>
                                        form.setData('contracted_value_estimated', event.target.value)
                                    }
                                />
                            </Field>
                            <Field label="Input Support (PHP)" htmlFor="input_support_amount" error={form.errors.input_support_amount}>
                                <Input
                                    id="input_support_amount"
                                    inputMode="decimal"
                                    value={form.data.input_support_amount}
                                    onChange={(event) =>
                                        form.setData('input_support_amount', event.target.value)
                                    }
                                />
                            </Field>
                            <Field label="Financing Support (PHP)" htmlFor="financing_support_amount" error={form.errors.financing_support_amount}>
                                <Input
                                    id="financing_support_amount"
                                    inputMode="decimal"
                                    value={form.data.financing_support_amount}
                                    onChange={(event) =>
                                        form.setData('financing_support_amount', event.target.value)
                                    }
                                />
                            </Field>
                            <Field label="Drone Image" htmlFor="drone_image" error={form.errors.drone_image}>
                                <Input
                                    id="drone_image"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(event) =>
                                        form.setData('drone_image', event.target.files?.[0] ?? null)
                                    }
                                />
                            </Field>
                        </CardContent>
                    </Card>

                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Additional information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Field
                                label="Notes"
                                htmlFor="notes"
                                error={form.errors.notes}
                            >
                                <textarea
                                    id="notes"
                                    value={form.data.notes}
                                    onChange={(event) =>
                                        form.setData('notes', event.target.value)
                                    }
                                    rows={4}
                                    className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                />
                            </Field>
                            <p className="text-xs text-muted-foreground">
                                New farms are registered as active. Verification
                                starts as pending and is not set on this form.
                                Farm status can be changed after the farm is
                                saved. Data validation is a separate reference
                                flag.
                            </p>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link href={showFarmer(farmer.id)}>Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing
                                ? 'Registering...'
                                : 'Register Farm'}
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}

RegisterFarm.layout = {
    breadcrumbs: [
        {
            title: 'Farmers',
            href: farmersIndex(),
        },
    ],
};
