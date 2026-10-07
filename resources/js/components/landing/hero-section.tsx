import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { login } from '@/routes';

export function HeroSection() {
    return (
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-24">
            <div className="max-w-xl">
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                    Agricultural management platform
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                    Smarter Farm Management. Verified from the Ground Up.
                </h1>
                <p className="mt-5 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
                    SureFarm brings farmer records, farm mapping, area
                    verification, and agricultural operations into one
                    connected platform.
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
                        <a href="#platform">Explore Platform</a>
                    </Button>
                </div>
            </div>

            <FarmLandscape />
        </section>
    );
}

function FarmLandscape() {
    return (
        <div className="relative">
            <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                <svg
                    viewBox="0 0 640 520"
                    role="img"
                    aria-label="Illustration of a coffee farm with mapped field boundaries and location markers"
                    className="h-auto w-full"
                >
                    <rect width="640" height="520" className="fill-muted" />
                    <path
                        d="M0 250 C80 210 140 280 220 240 C300 200 340 250 420 220 C500 190 560 230 640 200 L640 520 L0 520 Z"
                        className="fill-primary/15"
                    />
                    <path
                        d="M0 320 C120 280 180 340 280 310 C380 280 430 340 520 300 C580 280 610 300 640 290 L640 520 L0 520 Z"
                        className="fill-primary/35"
                    />
                    <path
                        d="M0 400 C160 360 240 420 360 390 C470 360 540 410 640 380 L640 520 L0 520 Z"
                        className="fill-primary/70"
                    />
                    <g className="stroke-primary/25" strokeWidth="1">
                        {Array.from({ length: 12 }, (_, index) => (
                            <line
                                key={`v-${index}`}
                                x1={40 + index * 52}
                                y1="28"
                                x2={40 + index * 52}
                                y2="492"
                            />
                        ))}
                        {Array.from({ length: 8 }, (_, index) => (
                            <line
                                key={`h-${index}`}
                                x1="24"
                                y1={40 + index * 60}
                                x2="616"
                                y2={40 + index * 60}
                            />
                        ))}
                    </g>
                    <path
                        d="M150 300 L250 250 L340 290 L310 370 L190 360 Z"
                        className="fill-secondary-foreground/20 stroke-secondary-foreground"
                        strokeWidth="3"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M380 250 L490 220 L540 300 L470 360 L390 330 Z"
                        className="fill-primary-foreground/10 stroke-primary"
                        strokeWidth="3"
                        strokeLinejoin="round"
                    />
                    <circle cx="250" cy="250" r="8" className="fill-primary" />
                    <circle
                        cx="250"
                        cy="250"
                        r="14"
                        className="fill-none stroke-primary"
                        strokeWidth="2"
                    />
                    <circle cx="490" cy="220" r="8" className="fill-secondary-foreground" />
                    <circle
                        cx="490"
                        cy="220"
                        r="14"
                        className="fill-none stroke-secondary-foreground"
                        strokeWidth="2"
                    />
                    <g className="fill-primary-foreground/80">
                        <path d="M120 430 c8-28 18-28 26 0 -8 6-18 6-26 0z" />
                        <path d="M168 450 c8-28 18-28 26 0 -8 6-18 6-26 0z" />
                        <path d="M430 430 c8-28 18-28 26 0 -8 6-18 6-26 0z" />
                        <path d="M478 455 c8-28 18-28 26 0 -8 6-18 6-26 0z" />
                    </g>
                </svg>
            </div>
            <div className="absolute right-4 bottom-4 left-4 grid grid-cols-2 gap-2 sm:right-auto sm:w-64">
                <div className="rounded-xl border bg-background/95 p-3 shadow-sm">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Map
                    </p>
                    <p className="mt-1 text-sm font-semibold">Field boundary</p>
                </div>
                <div className="rounded-xl border bg-background/95 p-3 shadow-sm">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Check
                    </p>
                    <p className="mt-1 text-sm font-semibold">Ready to verify</p>
                </div>
            </div>
        </div>
    );
}
