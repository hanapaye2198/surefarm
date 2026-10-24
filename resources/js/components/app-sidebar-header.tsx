import { usePage } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
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
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { auth } = usePage().props;
    const [searchOpen, setSearchOpen] = useState(false);
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
                    {breadcrumbs.length > 0 ? (
                        <div className="max-w-full overflow-hidden [&_ol]:flex-nowrap [&_ol]:text-xs">
                            <Breadcrumbs breadcrumbs={breadcrumbs} />
                        </div>
                    ) : (
                        <p className="truncate text-sm font-medium">SureFarm</p>
                    )}
                </div>

                <div className="hidden min-w-0 flex-1 lg:block lg:max-w-md xl:max-w-lg">
                    <GlobalSearch />
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

                <NotificationMenu />

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
                    <GlobalSearch autoFocus />
                </div>
            )}
        </header>
    );
}
