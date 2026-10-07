import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { login } from '@/routes';

const links = [
    { href: '#platform', label: 'Platform' },
    { href: '#how-it-works', label: 'How It Works' },
];

export function LandingFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-sm">
                    <div className="flex items-center gap-2.5 font-semibold">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-5" />
                        </span>
                        SureFarm
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Digital Farm Management & Verification Platform
                    </p>
                </div>
                <nav
                    aria-label="Footer"
                    className="flex flex-col gap-2 text-sm"
                >
                    {links.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            {link.label}
                        </a>
                    ))}
                    <Link
                        href={login()}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        Login
                    </Link>
                </nav>
            </div>
            <div className="border-t">
                <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
                    © {year} SureFarm. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
