import { Link, usePage } from '@inertiajs/react';
import { BadgeCheck, MapPinned, Sprout } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

const highlights: { title: string; text: string; icon: LucideIcon }[] = [
    {
        title: 'Farmer records',
        text: 'Profiles, households, and membership stay on one record.',
        icon: Sprout,
    },
    {
        title: 'Mapped boundaries',
        text: 'Draw the farm and keep the measured area with the file.',
        icon: MapPinned,
    },
    {
        title: 'Field verification',
        text: 'Compare declared hectares with the mapped area before approval.',
        icon: BadgeCheck,
    },
];

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name } = usePage().props;

    return (
        <div className="flex min-h-svh flex-col bg-canvas px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="m-auto grid w-full max-w-6xl overflow-hidden rounded-2xl border bg-background shadow-xl sm:rounded-3xl md:min-h-[min(40rem,calc(100svh-1.5rem))] md:grid-cols-2">
                <aside className="relative flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                    >
                        <div className="absolute -top-24 -left-16 size-72 rounded-full bg-sidebar-primary/25 blur-3xl" />
                        <div className="absolute -right-16 bottom-0 size-80 rounded-full bg-primary/40 blur-3xl" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,oklch(1_0_0/0.08)_1px,transparent_0)] bg-[size:22px_22px]" />
                    </div>

                    <div className="relative flex flex-1 flex-col justify-between gap-5 px-5 py-5 sm:px-8 sm:py-8 lg:gap-8 lg:p-10 xl:p-12">
                        <div>
                            <Link
                                href={home()}
                                className="inline-flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                            >
                                <span className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm sm:size-11">
                                    <AppLogoIcon className="size-5 fill-current sm:size-6" />
                                </span>
                                <span className="text-lg font-semibold tracking-tight">
                                    {name}
                                </span>
                            </Link>

                            <h2 className="mt-4 max-w-md text-xl font-semibold tracking-tight text-balance sm:mt-6 sm:text-2xl lg:mt-8 lg:text-4xl">
                                The operating record for every farm you manage.
                            </h2>
                            <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-sidebar-foreground/75 sm:block lg:text-base">
                                Farmer profiles, mapped boundaries, field
                                verification, and coffee traceability in one
                                place.
                            </p>
                        </div>

                        <ul className="flex flex-wrap gap-2 md:grid md:gap-2.5 lg:gap-3">
                            {highlights.map((item) => (
                                <li
                                    key={item.title}
                                    className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10 md:items-start md:gap-3 md:rounded-xl md:py-3"
                                >
                                    <span className="flex size-5 shrink-0 items-center justify-center text-sidebar-primary md:size-9 md:rounded-lg md:bg-sidebar-primary/15">
                                        <item.icon className="size-3.5 md:size-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-xs font-medium sm:text-sm">
                                            {item.title}
                                        </span>
                                        <span className="mt-0.5 hidden text-sm leading-snug text-sidebar-foreground/70 lg:block">
                                            {item.text}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <p className="hidden text-xs text-sidebar-foreground/60 lg:block">
                            Accounts are issued by your organization.
                        </p>
                    </div>
                </aside>

                <main className="flex items-center justify-center border-t px-5 py-6 sm:px-8 sm:py-8 md:border-t-0 md:border-l lg:px-12 lg:py-10 xl:px-16">
                    <div className="w-full max-w-md">
                        <div className="mb-5 space-y-2 sm:mb-6">
                            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                {title}
                            </h1>
                            <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
                                {description}
                            </p>
                        </div>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
