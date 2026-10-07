import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { index as activityTypesIndex, update } from '@/routes/activity-types';

type Option = {
    value: string;
    label: string;
};

type ActivityTypeRecord = {
    id: number;
    name: string;
    code: string | null;
    description: string | null;
    category: string | null;
    status: string;
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

export default function EditActivityType({
    activityType,
    categories,
    statuses,
}: {
    activityType: ActivityTypeRecord;
    categories: Option[];
    statuses: Option[];
}) {
    const form = useForm({
        name: activityType.name,
        code: activityType.code ?? '',
        description: activityType.description ?? '',
        category: activityType.category ?? '',
        status: activityType.status,
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.put(update.url(activityType.id));
    }

    return (
        <>
            <Head title={`Edit ${activityType.name}`} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Edit activity type"
                    description="Activate or deactivate a type without deleting historical activities."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={activityTypesIndex()}>
                                Back to types
                            </Link>
                        </Button>
                    }
                />
                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <form onSubmit={submit} className="grid max-w-xl gap-4">
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
                            <div>
                                <Button
                                    type="submit"
                                    disabled={form.processing}
                                >
                                    Save activity type
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

EditActivityType.layout = {
    breadcrumbs: [
        {
            title: 'Activity Types',
            href: activityTypesIndex(),
        },
    ],
};
