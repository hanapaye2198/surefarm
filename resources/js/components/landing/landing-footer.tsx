import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { login } from '@/routes';

const links = [
    { href: '#platform', label: 'Platform' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#verification', label: 'Verification' },
    { href: '#map', label: 'Map' },
    { href: '#about', label: 'About' },
];

export function LandingFooter() {
    const { name } = usePage().props;
    const year = new Date().getFullYear();

    return (
        <footer className="border-t">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-sm">
                    <AppLogoIcon className="h-10" alt={name} />
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Farmer records, mapped boundaries, field verification,
                        and coffee traceability for cooperatives and field
                        teams.
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Accounts are issued by your organization.
                    </p>
                </div>
                <nav
                    aria-label="Footer"
                    className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm"
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
                    © {year} {name}. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
