import {
    BadgeCheck,
    MapPinned,
    QrCode,
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
}[] = [
    {
        title: 'Farmer records',
        description:
            'Identity, location, household, and bank details in a structured profile.',
        icon: Users,
    },
    {
        title: 'Farm registration',
        description:
            'Crop, location, declared area, ownership, and status for every farm.',
        icon: Sprout,
    },
    {
        title: 'Farm mapping',
        description:
            'Locations and boundaries on an interactive map, with the measured area stored on the record.',
        icon: MapPinned,
    },
    {
        title: 'Field verification',
        description:
            'Declared hectares stay separate from the mapped area until a reviewer confirms the farm.',
        icon: BadgeCheck,
    },
    {
        title: 'Harvest and inventory',
        description:
            'Activities, production, harvest, receiving, processing, insurance, and financing.',
        icon: Tractor,
    },
    {
        title: 'Coffee traceability',
        description:
            'A public lot page follows coffee from the farm through harvest and processing.',
        icon: QrCode,
    },
];

export function PlatformFeatures() {
    return (
        <section id="platform" className="scroll-mt-20 border-t py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="max-w-2xl">
                    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        One record from registration to the lot.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        Register the farmer, map the farm, verify the area, and
                        follow the harvest without leaving SureFarm.
                    </p>
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <Card
                            key={feature.title}
                            className="h-full shadow-sm transition-shadow hover:shadow-md"
                        >
                            <CardHeader>
                                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <feature.icon className="size-5" />
                                </span>
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
