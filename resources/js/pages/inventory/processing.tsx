import { Head, Link } from '@inertiajs/react';
import { InventoryStageBars } from '@/components/inventory-stage-bars';
import type { InventorySummary } from '@/components/inventory-stage-bars';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { index as inventoryIndex, processing } from '@/routes/inventory';
import { create as processInventory } from '@/routes/inventory/process';

type Movement = {
    id: number;
    movement_date: string;
    summary: string;
    created_by: string | null;
    farm_name: string | null;
    farmer_name: string | null;
};

export default function CoffeeProcessing({
    summary,
    movements,
}: {
    summary: InventorySummary;
    movements: Movement[];
}) {
    return (
        <>
            <Head title="Coffee Processing" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Coffee Processing"
                    description="Track coffee movement through processing stages."
                    actions={
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button asChild>
                                <Link href={processInventory()}>Process coffee</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href={inventoryIndex()}>Back to inventory</Link>
                            </Button>
                        </div>
                    }
                />

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Processing flow</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <ol className="grid gap-2 sm:grid-cols-4">
                            {summary.stages.map((stage, index) => (
                                <li key={stage.id} className="rounded-xl border p-4">
                                    <p className="text-xs text-muted-foreground">Stage {index + 1}</p>
                                    <p className="font-medium">{stage.name}</p>
                                    <p className="text-lg font-semibold tabular-nums">{stage.label}</p>
                                    {index < summary.stages.length - 1 && (
                                        <p className="mt-2 text-xs text-muted-foreground sm:hidden">↓</p>
                                    )}
                                </li>
                            ))}
                        </ol>
                        <InventoryStageBars summary={summary} />
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent processing</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {movements.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No processing movements yet.</p>
                        ) : (
                            movements.map((movement) => (
                                <div key={movement.id} className="border-b pb-4 last:border-0 last:pb-0">
                                    <p className="text-sm font-medium">{movement.movement_date}</p>
                                    <p className="text-sm">{movement.summary}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {[movement.farmer_name, movement.farm_name, movement.created_by].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

CoffeeProcessing.layout = {
    breadcrumbs: [
        {
            title: 'Inventory',
            href: inventoryIndex(),
        },
        {
            title: 'Coffee Processing',
            href: processing(),
        },
    ],
};
