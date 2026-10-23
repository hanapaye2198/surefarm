import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { create, index as cooperativesIndex, store } from '@/routes/cooperatives';

export default function CreateCooperative() {
    const form = useForm({ name: '', code: '' });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(store.url());
    }

    return (
        <>
            <Head title="Register cooperative" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader title="Register cooperative" description="A new cooperative starts active and can receive members." />
                <form onSubmit={submit}>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Cooperative</CardTitle>
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
                    <Button type="submit" className="mt-4" disabled={form.processing}>Save cooperative</Button>
                </form>
            </div>
        </>
    );
}

CreateCooperative.layout = {
    breadcrumbs: [
        { title: 'Cooperatives', href: cooperativesIndex() },
        { title: 'Register', href: create() },
    ],
};
