import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    edit,
    index as activityTypesIndex,
    store,
} from '@/routes/activity-types';

type Option = {
    value: string;
    label: string;
};

type ActivityTypeRow = {
    id: number;
    name: string;
    code: string | null;
    description: string | null;
    category_label: string;
    status: string;
    status_label: string;
    activities_count: number | null;
};

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

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

export default function ActivityTypesIndex({
    activityTypes,
    categories,
    statuses,
}: {
    activityTypes: ActivityTypeRow[];
    categories: Option[];
    statuses: Option[];
}) {
    const form = useForm({
        name: '',
        code: '',
        description: '',
        category: '',
        status: 'active',
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(store.url(), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    }

    return (
        <>
            <Head title="Activity Types" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Activity Types"
                    description="Master list used when recording farm activities."
                />

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Add activity type</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={submit}
                            className="grid gap-4 sm:grid-cols-2"
                        >
                            <Field
                                label="Name"
                                htmlFor="name"
                                error={form.errors.name}
                            >
                                <Input
                                    id="name"
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                label="Code"
                                htmlFor="code"
                                error={form.errors.code}
                            >
                                <Input
                                    id="code"
                                    value={form.data.code}
                                    onChange={(event) =>
                                        form.setData('code', event.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                label="Category"
                                htmlFor="category"
                                error={form.errors.category}
                            >
                                <select
                                    id="category"
                                    value={form.data.category}
                                    onChange={(event) =>
                                        form.setData(
                                            'category',
                                            event.target.value,
                                        )
                                    }
                                    className={selectClassName}
                                >
                                    <option value="">No category</option>
                                    {categories.map((category) => (
                                        <option
                                            key={category.value}
                                            value={category.value}
                                        >
                                            {category.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Status"
                                htmlFor="status"
                                error={form.errors.status}
                            >
                                <select
                                    id="status"
                                    value={form.data.status}
                                    onChange={(event) =>
                                        form.setData(
                                            'status',
                                            event.target.value,
                                        )
                                    }
                                    className={selectClassName}
                                >
                                    {statuses.map((status) => (
                                        <option
                                            key={status.value}
                                            value={status.value}
                                        >
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
                                    <Input
                                        id="description"
                                        value={form.data.description}
                                        onChange={(event) =>
                                            form.setData(
                                                'description',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            </div>
                            <div>
                                <Button
                                    type="submit"
                                    disabled={form.processing}
                                >
                                    Create activity type
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <DataTable
                    columns={[
                        'Name',
                        'Code',
                        'Category',
                        'Status',
                        'Used',
                        'Actions',
                    ]}
                    rows={activityTypes.map((type) => ({
                        id: type.id,
                        cells: [
                            type.name,
                            type.code ?? '—',
                            type.category_label,
                            type.status_label,
                            type.activities_count ?? 0,
                            <Button
                                key="edit"
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <Link href={edit(type.id)}>Edit</Link>
                            </Button>,
                        ],
                    }))}
                    emptyTitle="No activity types yet."
                    emptyDescription="Create a type before recording farm activities."
                />
            </div>
        </>
    );
}

ActivityTypesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Activity Types',
            href: activityTypesIndex(),
        },
    ],
};
