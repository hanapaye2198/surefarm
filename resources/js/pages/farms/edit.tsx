import { Head, Link, setLayoutProps, useForm, usePage } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateFarmForm } from '@/lib/validate-farm-form';
import { show as showFarmer } from '@/routes/farmers';
import { edit, index as farmsIndex, show, update } from '@/routes/farms';

type Option = { value: string; label: string };

type FarmForm = {
    id: number;
    farm_id: string;
    farm_name: string;
    crop_type: string;
    declared_area_hectares: string;
    purok_sitio: string;
    barangay: string;
    municipality: string;
    province: string;
    latitude: string;
    longitude: string;
    status: string;
    current_stage: string;
    number_of_hills: string;
    data_validated: string;
    property_ownership: string;
    contracted_value_estimated: string;
    input_support_amount: string;
    financing_support_amount: string;
    notes: string;
    drone_image_url: string | null;
    farmer: { id: number; full_name: string };
};

function Field({
    label,
    htmlFor,
    error,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

const selectClass =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none';

export default function EditFarm({
    farm,
    crops,
    statuses,
    stages,
    ownerships,
}: {
    farm: FarmForm;
    crops: Option[];
    statuses: Option[];
    stages: Option[];
    ownerships: Option[];
}) {
    const pageErrors = usePage().props.errors as Record<string, string> | undefined;
    const form = useForm({
        ...farm,
        drone_image: null as File | null,
    });

    setLayoutProps({
        breadcrumbs: [
            { title: 'Farms & Map', href: farmsIndex() },
            { title: farm.farm_name || farm.farm_id, href: show(farm.id) },
            { title: 'Edit farm', href: edit(farm.id) },
        ],
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const clientErrors = validateFarmForm({
            crop_type: form.data.crop_type,
            declared_area_hectares: form.data.declared_area_hectares,
            latitude: String(form.data.latitude),
            longitude: String(form.data.longitude),
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
            delete payload.farmer;
            delete payload.farm_id;
            delete payload.id;
            delete payload.drone_image_url;

            if (!data.drone_image) {
                delete payload.drone_image;
            }

            return payload;
        });
        form.put(update.url(farm.id), {
            forceFormData: form.data.drone_image !== null,
        });
    }

    return (
        <>
            <Head title={`Edit ${farm.farm_name || farm.farm_id}`} />
            <form onSubmit={submit} noValidate className="flex flex-col gap-5">
                <PageHeader
                    title="Edit farm"
                    description={`${farm.farmer.full_name} · ${farm.farm_id}`}
                />
                <InputError message={pageErrors?.farm} />
                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Farm information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field label="Farm Name" htmlFor="farm_name" error={form.errors.farm_name}>
                            <Input id="farm_name" value={form.data.farm_name} onChange={(event) => form.setData('farm_name', event.target.value)} />
                        </Field>
                        <Field label="Crop" htmlFor="crop_type" error={form.errors.crop_type}>
                            <select id="crop_type" value={form.data.crop_type} onChange={(event) => form.setData('crop_type', event.target.value)} className={selectClass}>
                                {crops.map((crop) => (
                                    <option key={crop.value} value={crop.value}>{crop.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Declared Area (ha)" htmlFor="declared_area_hectares" error={form.errors.declared_area_hectares}>
                            <Input id="declared_area_hectares" value={form.data.declared_area_hectares} onChange={(event) => form.setData('declared_area_hectares', event.target.value)} />
                        </Field>
                        <Field label="Farm Status" htmlFor="status" error={form.errors.status}>
                            <select id="status" value={form.data.status} onChange={(event) => form.setData('status', event.target.value)} className={selectClass}>
                                {statuses.map((status) => (
                                    <option key={status.value} value={status.value}>{status.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Current Stage" htmlFor="current_stage" error={form.errors.current_stage}>
                            <select id="current_stage" value={form.data.current_stage} onChange={(event) => form.setData('current_stage', event.target.value)} className={selectClass}>
                                <option value="">Not provided</option>
                                {stages.map((stage) => (
                                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Property Ownership" htmlFor="property_ownership" error={form.errors.property_ownership}>
                            <select id="property_ownership" value={form.data.property_ownership} onChange={(event) => form.setData('property_ownership', event.target.value)} className={selectClass}>
                                <option value="">Not provided</option>
                                {ownerships.map((ownership) => (
                                    <option key={ownership.value} value={ownership.value}>{ownership.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="No. of Hills" htmlFor="number_of_hills" error={form.errors.number_of_hills}>
                            <Input id="number_of_hills" value={form.data.number_of_hills} onChange={(event) => form.setData('number_of_hills', event.target.value)} />
                        </Field>
                        <Field label="Data validation" htmlFor="data_validated" error={form.errors.data_validated}>
                            <select id="data_validated" value={form.data.data_validated} onChange={(event) => form.setData('data_validated', event.target.value)} className={selectClass}>
                                <option value="">Not provided</option>
                                <option value="1">Yes</option>
                                <option value="0">No</option>
                            </select>
                        </Field>
                        <Field label="Purok / Sitio" htmlFor="purok_sitio" error={form.errors.purok_sitio}>
                            <Input id="purok_sitio" value={form.data.purok_sitio} onChange={(event) => form.setData('purok_sitio', event.target.value)} />
                        </Field>
                        <Field label="Barangay" htmlFor="barangay" error={form.errors.barangay}>
                            <Input id="barangay" value={form.data.barangay} onChange={(event) => form.setData('barangay', event.target.value)} />
                        </Field>
                        <Field label="Municipality / City" htmlFor="municipality" error={form.errors.municipality}>
                            <Input id="municipality" value={form.data.municipality} onChange={(event) => form.setData('municipality', event.target.value)} />
                        </Field>
                        <Field label="Province" htmlFor="province" error={form.errors.province}>
                            <Input id="province" value={form.data.province} onChange={(event) => form.setData('province', event.target.value)} />
                        </Field>
                        <Field label="Latitude" htmlFor="latitude" error={form.errors.latitude}>
                            <Input id="latitude" value={String(form.data.latitude)} onChange={(event) => form.setData('latitude', event.target.value)} />
                        </Field>
                        <Field label="Longitude" htmlFor="longitude" error={form.errors.longitude}>
                            <Input id="longitude" value={String(form.data.longitude)} onChange={(event) => form.setData('longitude', event.target.value)} />
                        </Field>
                        <Field label="Contracted Value (PHP)" htmlFor="contracted_value_estimated" error={form.errors.contracted_value_estimated}>
                            <Input id="contracted_value_estimated" value={form.data.contracted_value_estimated} onChange={(event) => form.setData('contracted_value_estimated', event.target.value)} />
                        </Field>
                        <Field label="Input Support (PHP)" htmlFor="input_support_amount" error={form.errors.input_support_amount}>
                            <Input id="input_support_amount" value={form.data.input_support_amount} onChange={(event) => form.setData('input_support_amount', event.target.value)} />
                        </Field>
                        <Field label="Financing Support (PHP)" htmlFor="financing_support_amount" error={form.errors.financing_support_amount}>
                            <Input id="financing_support_amount" value={form.data.financing_support_amount} onChange={(event) => form.setData('financing_support_amount', event.target.value)} />
                        </Field>
                        <Field label="Notes" htmlFor="notes" error={form.errors.notes}>
                            <Input id="notes" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                        </Field>
                        <Field label="Drone Image" htmlFor="drone_image" error={form.errors.drone_image}>
                            <Input id="drone_image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => form.setData('drone_image', event.target.files?.[0] ?? null)} />
                            <p className="text-xs text-muted-foreground">
                                {farm.drone_image_url ? 'A drone image is already saved. Choose a file only to replace it.' : 'Drone image not available yet.'}
                            </p>
                        </Field>
                    </CardContent>
                </Card>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" asChild>
                        <Link href={showFarmer(farm.farmer.id)}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Saving...' : 'Save farm'}
                    </Button>
                </div>
            </form>
        </>
    );
}

EditFarm.layout = {
    breadcrumbs: [{ title: 'Farms & Map', href: farmsIndex() }],
};
