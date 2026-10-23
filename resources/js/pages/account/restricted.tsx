import { Head, Link } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { edit } from '@/routes/profile';

export default function RestrictedAccount() {
    return (
        <>
            <Head title="Account" />
            <div className="flex flex-col gap-5">
                <PageHeader
                    title="Account"
                    description="This login does not have access to the farmer registry."
                />
                <Card className="shadow-sm">
                    <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                        <p>
                            An administrator must link this account to a farmer
                            record before farms, harvests, or payments can be
                            shown.
                        </p>
                        <Button asChild>
                            <Link href={edit()}>Profile settings</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
