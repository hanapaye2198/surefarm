import { usePage } from '@inertiajs/react';
import { Bell, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

function SearchField({ autoFocus = false }: { autoFocus?: boolean }) {
    return (
        <div className="relative w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                autoFocus={autoFocus}
                type="search"
                placeholder="Search farmers, farms, locations..."
                aria-label="Search farmer, farm, cooperative, or location"
                className="h-10 rounded-full border-transparent bg-muted/80 pr-4 pl-10 shadow-none focus-visible:border-input focus-visible:bg-background md:text-sm"
            />
        </div>
    );
}

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { auth } = usePage().props;
    const [searchOpen, setSearchOpen] = useState(false);
    const title = breadcrumbs.at(-1)?.title ?? 'SureFarm';
    const trail = breadcrumbs.length > 1 ? breadcrumbs.slice(0, -1) : [];

    return (
        <header className="z-30 shrink-0 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
            <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-5">
                <SidebarTrigger className="size-9 shrink-0 rounded-lg" />

                <div
                    className={cn(
                        'min-w-0 flex-1',
                        searchOpen && 'max-lg:hidden',
                    )}
                >
                    {trail.length > 0 && (
                        <div className="hidden max-w-full overflow-hidden sm:block [&_ol]:flex-nowrap [&_ol]:text-xs">
                            <Breadcrumbs breadcrumbs={trail} />
                        </div>
                    )}
                    <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
                        {title}
                    </p>
                </div>

                <div className="hidden min-w-0 flex-1 lg:block lg:max-w-md xl:max-w-lg">
                    <SearchField />
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-lg lg:hidden"
                    aria-label={searchOpen ? 'Close search' : 'Open search'}
                    aria-expanded={searchOpen}
                    onClick={() => setSearchOpen((open) => !open)}
                >
                    {searchOpen ? <X /> : <Search />}
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-lg"
                            aria-label="Notifications"
                        >
                            <Bell />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 rounded-xl">
                        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <p className="px-2 py-4 text-sm text-muted-foreground">
                            No notifications.
                        </p>
                    </DropdownMenuContent>
                </DropdownMenu>

                {auth.user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-10 max-w-44 shrink-0 rounded-full px-1.5 sm:max-w-56 sm:px-2"
                            >
                                <UserInfo
                                    user={auth.user}
                                    detailsClassName="hidden sm:grid"
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="min-w-56 rounded-xl"
                        >
                            <UserMenuContent user={auth.user} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {searchOpen && (
                <div className="border-t px-3 py-3 lg:hidden">
                    <SearchField autoFocus />
                </div>
            )}
        </header>
    );
}
