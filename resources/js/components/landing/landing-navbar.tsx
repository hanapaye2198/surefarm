import { Link, usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dashboard, login } from '@/routes';

const links = [
    { href: '#top', label: 'Home' },
    { href: '#platform', label: 'Platform' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#about', label: 'About' },
];

export function LandingNavbar() {
    const { auth, name } = usePage().props;
    const [open, setOpen] = useState(false);
    const authenticated = auth.user !== null;

    function closeMenu() {
        setOpen(false);
    }

    return (
        <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
                <a
                    href="#top"
                    className="flex min-w-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={closeMenu}
                >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <AppLogoIcon className="size-5" />
                    </span>
                    <span className="truncate">{name}</span>
                </a>

                <nav
                    aria-label="Primary"
                    className="ml-6 hidden items-center gap-1 lg:flex"
                >
                    {links.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="ml-auto hidden lg:block">
                    {authenticated ? (
                        <Button asChild>
                            <Link href={dashboard()}>Access Dashboard</Link>
                        </Button>
                    ) : (
                        <Button asChild>
                            <Link href={login()}>Login</Link>
                        </Button>
                    )}
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto lg:hidden"
                    aria-expanded={open}
                    aria-controls="landing-menu"
                    onClick={() => setOpen((value) => !value)}
                >
                    {open ? <X /> : <Menu />}
                    <span className="sr-only">
                        {open ? 'Close menu' : 'Open menu'}
                    </span>
                </Button>
            </div>

            <div
                id="landing-menu"
                className={cn('border-t lg:hidden', open ? 'block' : 'hidden')}
            >
                <nav
                    aria-label="Mobile"
                    className="flex flex-col gap-1 px-4 py-3"
                >
                    {links.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            onClick={closeMenu}
                        >
                            {link.label}
                        </a>
                    ))}
                    {authenticated ? (
                        <Button asChild className="mt-2">
                            <Link href={dashboard()} onClick={closeMenu}>
                                Access Dashboard
                            </Link>
                        </Button>
                    ) : (
                        <Button asChild className="mt-2">
                            <Link href={login()} onClick={closeMenu}>
                                Login
                            </Link>
                        </Button>
                    )}
                </nav>
            </div>
        </header>
    );
}
