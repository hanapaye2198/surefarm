import { ClipboardList, Smartphone, Sprout, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const audiences: {
    title: string;
    description: string;
    icon: LucideIcon;
}[] = [
    {
        title: 'Cooperatives',
        description:
            'Keep member farmers, farms, and shared production in one record instead of scattered files.',
        icon: Users,
    },
    {
        title: 'Operations',
        description:
            'Register farmers and farms, then record activities, production, harvest, inventory, insurance, and financing.',
        icon: ClipboardList,
    },
    {
        title: 'Field verifiers',
        description:
            'Walk a boundary, capture GPS and photos, and compare the measured area with what was declared.',
        icon: Sprout,
    },
    {
        title: 'Farmers',
        description:
            'Open their own farms and records in the browser or in the SureFarm mobile app.',
        icon: Smartphone,
    },
];

export function Audiences() {
    return (
        <section
            id="who-its-for"
            className="scroll-mt-20 border-t bg-muted/40 py-16 sm:py-20"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="max-w-2xl">
                    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        Built for the people who run the farms.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        Each role sees the same farm record, with access limited
                        to the work they are responsible for.
                    </p>
                </div>
                <ul className="mt-10 grid gap-4 sm:grid-cols-2">
                    {audiences.map((audience) => (
                        <li
                            key={audience.title}
                            className="rounded-2xl border bg-card p-5 shadow-sm"
                        >
                            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <audience.icon className="size-5" />
                            </span>
                            <h3 className="mt-4 text-lg font-semibold tracking-tight">
                                {audience.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {audience.description}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
