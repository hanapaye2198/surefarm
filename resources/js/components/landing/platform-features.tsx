import {
    BarChart3,
    BadgeCheck,
    MapPinned,
    Sprout,
    Tractor,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features: {
    title: string;
    description: string;
    icon: LucideIcon;
    status: 'Available' | 'Planned';
}[] = [
    {
        title: 'Farmer Management',
        description: 'Maintain structured farmer profiles and records.',
        icon: Users,
        status: 'Available',
    },
    {
        title: 'Farm Registration',
        description: 'Register farms, locations, crops, and declared areas.',
        icon: Sprout,
        status: 'Available',
    },
    {
        title: 'Farm Mapping',
        description:
            'Visualize farm locations and boundaries on an interactive map.',
        icon: MapPinned,
        status: 'Available',
    },
    {
        title: 'Area Verification',
        description:
            'Compare declared and measured farm areas before verification.',
        icon: BadgeCheck,
        status: 'Available',
    },
    {
        title: 'Agricultural Operations',
        description:
            'A foundation for activities, production, inventory, and logistics is planned.',
        icon: Tractor,
        status: 'Planned',
    },
    {
        title: 'Reports & Insights',
        description:
            'Dashboard summaries are available today. A full reports module is planned.',
        icon: BarChart3,
        status: 'Planned',
    },
];

export function PlatformFeatures() {
    return (
        <section
            id="platform"
            className="scroll-mt-20 border-t bg-muted/40 py-16 sm:py-20"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="max-w-2xl">
                    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        Everything you need to manage the farm lifecycle.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        SureFarm helps organizations manage farmers, farms, farm
                        areas, verification, production, and agricultural
                        operations in one platform.
                    </p>
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <Card
                            key={feature.title}
                            className="h-full shadow-sm transition-shadow hover:shadow-md"
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <feature.icon className="size-5" />
                                    </span>
                                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium tracking-wide text-secondary-foreground uppercase">
                                        {feature.status}
                                    </span>
                                </div>
                                <CardTitle className="text-lg">
                                    {feature.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {feature.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
