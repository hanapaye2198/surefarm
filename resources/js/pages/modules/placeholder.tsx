import { Head, setLayoutProps } from '@inertiajs/react';
import {
    BarChart3,
    Handshake,
    Landmark,
    ListChecks,
    Shield,
    Sprout,
    Truck,
    Warehouse,
    Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { show as showModule } from '@/routes/modules';

const icons = {
    sprout: Sprout,
    'list-checks': ListChecks,
    wheat: Wheat,
    warehouse: Warehouse,
    landmark: Landmark,
    shield: Shield,
    truck: Truck,
    handshake: Handshake,
    chart: BarChart3,
} as const satisfies Record<string, LucideIcon>;

type ModuleIcon = keyof typeof icons;

export default function ModulePlaceholder({
    module,
    title,
    description,
    icon,
}: {
    module: string;
    title: string;
    description: string;
    icon: ModuleIcon;
}) {
    const Icon = icons[icon] ?? Sprout;

    setLayoutProps({
        breadcrumbs: [
            {
                title,
                href: showModule(module),
            },
        ],
    });

    return (
        <>
            <Head title={title} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader title={title} description={description} />
                <Card className="shadow-sm">
                    <EmptyState
                        icon={<Icon className="size-5" />}
                        title={title}
                        description={description}
                    />
                </Card>
            </div>
        </>
    );
}
