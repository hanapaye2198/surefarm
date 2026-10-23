import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { index as cooperativesIndex, update } from '@/routes/cooperatives';

export default function EditCooperative({
    cooperative,
}: {
    cooperative: { id: number; name: string; code: string };
}) {
    const form = useForm({ name: cooperative.name, code: cooperative.code });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.put(update.url(cooperative.id));
    }

    return (
        <>
            <Head title={`Edit ${cooperative.name}`} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader title="Edit cooperative" description="Name and code can change. Membership history stays with the cooperative." />
                <form onSubmit={submit}>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>{cooperative.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
                                <InputError message={form.errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="code">Code</Label>
                                <Input id="code" value={form.data.code} onChange={(event) => form.setData('code', event.target.value)} />
                                <InputError message={form.errors.code} />
                            </div>
                        </CardContent>
                    </Card>
                    <Button type="submit" className="mt-4" disabled={form.processing}>Save changes</Button>
                </form>
            </div>
        </>
    );
}

EditCooperative.layout = {
    breadcrumbs: [
        { title: 'Cooperatives', href: cooperativesIndex() },
    ],
};
