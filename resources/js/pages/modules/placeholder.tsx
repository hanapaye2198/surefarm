import { Head, Link, setLayoutProps } from '@inertiajs/react';
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
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    status,
    links = [],
}: {
    module: string;
    title: string;
    description: string;
    icon: ModuleIcon;
    status: 'partial' | 'planned';
    links?: { label: string; href: string }[];
}) {
    const Icon = icons[icon] ?? Sprout;
    const label = status === 'partial' ? 'Partial' : 'Planned';

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
                <PageHeader
                    title={title}
                    description={description}
                    actions={<Badge variant="outline">{label}</Badge>}
                />
                <Card className="shadow-sm">
                    <CardContent className="flex flex-col items-start gap-4 py-8">
                        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Icon className="size-5" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-base font-medium">
                                {status === 'partial'
                                    ? 'Part of this is already recorded elsewhere.'
                                    : 'This workspace is not available yet.'}
                            </h2>
                            <p className="max-w-xl text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                        {links.length > 0 && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                {links.map((link) => (
                                    <Button
                                        key={link.href}
                                        variant="outline"
                                        asChild
                                    >
                                        <Link href={link.href}>
                                            {link.label}
                                        </Link>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
