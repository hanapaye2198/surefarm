import { Link, usePage } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { navigationSection } from '@/lib/app-navigation';
import { GlobalSearch } from '@/components/global-search';
import { NotificationMenu } from '@/components/notification-menu';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { roleLabel } from '@/lib/access';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { auth } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const [searchOpen, setSearchOpen] = useState(false);
    const pageTitle = breadcrumbs.at(-1)?.title ?? 'Workspace';
    const parents = breadcrumbs.slice(0, -1);
    const section = navigationSection(currentUrl, auth.user?.role);

    return (
        <header className="z-30 shrink-0 border-b bg-background pt-[env(safe-area-inset-top)]">
            <div className="flex h-14 items-center gap-2 px-2 sm:gap-3 sm:px-4">
                <SidebarTrigger className="size-8 shrink-0 rounded-sm border border-border bg-muted/50" />

                <span
                    className="hidden h-7 w-0.5 shrink-0 bg-primary sm:block"
                    aria-hidden
                />

                <div
                    className={cn(
                        'min-w-0 flex-1',
                        searchOpen && 'max-lg:hidden',
                    )}
                >
                    <p className="truncate text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        {section
                            ? `${section.code} ${section.label}`
                            : 'Operations'}
                        {parents.map((item, index) => (
                            <span key={index}>
                                {' / '}
                                <Link
                                    href={item.href}
                                    className="hover:text-foreground"
                                >
                                    {item.title}
                                </Link>
                            </span>
                        ))}
                    </p>
                    <p className="truncate text-sm leading-tight font-semibold tracking-tight">
                        {pageTitle}
                    </p>
                </div>

                <div className="hidden w-full max-w-sm shrink-0 lg:block xl:max-w-md">
                    <GlobalSearch />
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-sm border border-border lg:hidden"
                    aria-label={searchOpen ? 'Close search' : 'Open search'}
                    aria-expanded={searchOpen}
                    onClick={() => setSearchOpen((open) => !open)}
                >
                    {searchOpen ? <X /> : <Search />}
                </Button>

                <NotificationMenu />

                {auth.user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-9 max-w-44 shrink-0 rounded-sm border border-transparent px-1.5 hover:border-border hover:bg-muted/60 sm:max-w-56 sm:px-2"
                            >
                                <UserInfo
                                    user={auth.user}
                                    meta={roleLabel(auth.user.role)}
                                    detailsClassName="hidden sm:grid"
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="min-w-56 rounded-sm"
                        >
                            <UserMenuContent user={auth.user} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {searchOpen && (
                <div className="border-t bg-muted/30 px-3 py-3 lg:hidden">
                    <GlobalSearch autoFocus />
                </div>
            )}
        </header>
    );
}
