import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { login } from '@/routes';

const highlights = [
    'Farmer records',
    'Mapped boundaries',
    'Field verification',
    'Public traceability',
];

export function HeroSection() {
    return (
        <section className="mx-auto grid max-w-6xl items-center gap-12 overflow-x-clip px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-24">
            <div className="max-w-xl">
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                    For cooperatives and field teams
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                    The operating record for every farm you manage.
                </h1>
                <p className="mt-5 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
                    SureFarm keeps farmer profiles, mapped boundaries, field
                    verification, harvest, inventory, and coffee traceability in
                    one place.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button asChild size="lg" className="w-full sm:w-auto">
                        <Link href={login()}>Access SureFarm</Link>
                    </Button>
                    <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto"
                    >
                        <a href="#how-it-works">See how it works</a>
                    </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                    Accounts are issued by your organization. Field teams can
                    also use the SureFarm mobile app.
                </p>
                <ul className="mt-8 flex flex-wrap gap-2">
                    {highlights.map((item) => (
                        <li
                            key={item}
                            className="rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                            {item}
                        </li>
                    ))}
                </ul>
            </div>

            <ProductPreview />
        </section>
    );
}

function ProductPreview() {
    return (
        <div className="relative">
            <div
                aria-hidden
                className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-primary/10 blur-2xl"
            />
            <div className="overflow-hidden rounded-3xl border bg-card shadow-lg">
                <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Farm record
                    </p>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary uppercase">
                        Verified
                    </span>
                </div>
                <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    <div className="border-b p-5 sm:border-r sm:border-b-0">
                        <p className="text-lg font-semibold tracking-tight">
                            Kalasungay Coffee
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Malaybalay, Bukidnon
                        </p>
                        <dl className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-muted/70 px-3 py-3">
                                <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                    Declared
                                </dt>
                                <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                                    2.50 ha
                                </dd>
                            </div>
                            <div className="rounded-2xl bg-muted/70 px-3 py-3">
                                <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                    Measured
                                </dt>
                                <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                                    2.46 ha
                                </dd>
                            </div>
                        </dl>
                        <p className="mt-4 text-sm text-muted-foreground">
                            Coffee · Harvest on record · 0.04 ha difference
                        </p>
                    </div>
                    <BoundarySketch />
                </div>
                <p className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">
                    Preview of the SureFarm demo walkthrough. These figures are
                    not a live record from your organization.
                </p>
            </div>
        </div>
    );
}

function BoundarySketch() {
    return (
        <svg
            viewBox="0 0 320 280"
            role="img"
            aria-label="Stylized farm boundary for the Kalasungay Coffee preview"
            className="h-full min-h-48 w-full bg-muted/50"
        >
            <g className="stroke-border" strokeWidth="1">
                {Array.from({ length: 7 }, (_, index) => (
                    <line
                        key={`v-${index}`}
                        x1={index * 54}
                        y1="0"
                        x2={index * 54}
                        y2="280"
                    />
                ))}
                {Array.from({ length: 6 }, (_, index) => (
                    <line
                        key={`h-${index}`}
                        x1="0"
                        y1={index * 56}
                        x2="320"
                        y2={index * 56}
                    />
                ))}
            </g>
            <path
                d="M70 190 L130 70 L250 100 L230 210 L120 230 Z"
                className="fill-primary/25 stroke-primary"
                strokeWidth="3"
                strokeLinejoin="round"
            />
            <circle cx="130" cy="70" r="6" className="fill-primary" />
            <circle
                cx="130"
                cy="70"
                r="12"
                className="fill-none stroke-primary"
                strokeWidth="2"
            />
        </svg>
    );
}
