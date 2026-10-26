import { Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, Search, X } from 'lucide-react';
import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import AppLogo from '@/components/app-logo';
import { NavUser } from '@/components/nav-user';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import {
    visibleNavigation,
    winningItem,
    type SidebarLink,
} from '@/lib/app-navigation';
import { toUrl } from '@/lib/utils';
import { dashboard } from '@/routes';

const sectionStorageKey = 'surefarm-nav-sections';

const itemClassName =
    'relative h-9 rounded-sm px-2 text-[0.8125rem] text-sidebar-foreground/80 before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:bg-transparent hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary data-[active=true]:before:bg-sidebar-primary';

function readClosedSections(): string[] {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const raw = window.localStorage.getItem(sectionStorageKey);
        const parsed: unknown = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(
            (value): value is string => typeof value === 'string',
        );
    } catch {
        return [];
    }
}

export function AppSidebar() {
    const { auth } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const { isMobile, openMobile, setOpen, setOpenMobile, state } =
        useSidebar();
    const role = auth.user?.role;
    const filterRef = useRef<HTMLInputElement>(null);
    const focusFilter = useRef(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const [closed, setClosed] = useState<string[]>([]);
    const [sectionsReady, setSectionsReady] = useState(false);
    const visibleGroups = visibleNavigation(role);
    const winner = winningItem(currentUrl, visibleGroups);
    const activeGroup = visibleGroups.find((group) =>
        group.items.some((item) => item === winner),
    )?.label;
    const filtering = query.trim() !== '';
    const iconMode = !isMobile && state === 'collapsed';
    const filteredGroups = visibleGroups
        .map((group) => ({
            ...group,
            items: filtering
                ? group.items.filter((item) => {
                      const term = query.trim().toLowerCase();

                      return (
                          item.title.toLowerCase().includes(term) ||
                          group.label.toLowerCase().includes(term)
                      );
                  })
                : group.items,
        }))
        .filter((group) => group.items.length > 0);
    const matches = filteredGroups.flatMap((group) => group.items);

    useEffect(() => {
        setClosed(
            readClosedSections().filter((label) => label !== activeGroup),
        );
        setSectionsReady(true);
    }, [activeGroup]);

    useEffect(() => {
        if (!sectionsReady) {
            return;
        }

        try {
            window.localStorage.setItem(
                sectionStorageKey,
                JSON.stringify(closed),
            );
        } catch {
            // The rail still works if the browser blocks storage.
        }
    }, [closed, sectionsReady]);

    useEffect(() => {
        setCursor(0);
    }, [query]);

    useEffect(() => {
        if (!focusFilter.current) {
            return;
        }

        if (isMobile && !openMobile) {
            return;
        }

        if (!isMobile && state === 'collapsed') {
            return;
        }

        focusFilter.current = false;
        filterRef.current?.focus();
    }, [isMobile, openMobile, state]);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (
                event.key !== '/' ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey
            ) {
                return;
            }

            const target = event.target;

            if (
                target instanceof HTMLElement &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable)
            ) {
                return;
            }

            event.preventDefault();

            if (isMobile) {
                focusFilter.current = true;
                setOpenMobile(true);
            } else if (state === 'collapsed') {
                focusFilter.current = true;
                setOpen(true);
            } else {
                filterRef.current?.focus();
            }
        }

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobile, setOpen, setOpenMobile, state]);

    function active(item: SidebarLink): boolean {
        return item === winner;
    }

    function sectionOpen(label: string): boolean {
        return iconMode || filtering || !closed.includes(label);
    }

    function toggleSection(label: string, next: boolean) {
        if (iconMode || filtering) {
            return;
        }

        setClosed((current) =>
            next
                ? current.filter((item) => item !== label)
                : [...current, label],
        );
    }

    function onFilterKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Escape') {
            setQuery('');
            event.currentTarget.blur();

            return;
        }

        if (!filtering || matches.length === 0) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor((index) => (index + 1) % matches.length);
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((index) => (index - 1 + matches.length) % matches.length);
        }

        if (event.key === 'Enter' && matches[cursor]) {
            event.preventDefault();
            router.visit(toUrl(matches[cursor].href));
            setQuery('');
        }
    }

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            className="h-auto rounded-sm px-1.5 py-1 hover:bg-sidebar-accent"
                            asChild
                        >
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <p className="px-1.5 text-[10px] font-semibold tracking-[0.18em] text-sidebar-foreground/45 uppercase group-data-[collapsible=icon]:hidden">
                    Operations console
                </p>
                <div className="relative group-data-[collapsible=icon]:hidden">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/45" />
                    <input
                        ref={filterRef}
                        value={query}
                        type="search"
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="Find a page"
                        aria-label="Find a page"
                        aria-keyshortcuts="/"
                        className="h-8 w-full rounded-sm border border-sidebar-border bg-black/20 pr-12 pl-8 text-xs text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/40 focus-visible:border-sidebar-ring focus-visible:ring-2 focus-visible:ring-sidebar-ring/40 [&::-webkit-search-cancel-button]:hidden"
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onFilterKeyDown}
                    />
                    {query === '' ? (
                        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 border border-sidebar-border px-1 text-[10px] font-medium text-sidebar-foreground/50">
                            /
                        </kbd>
                    ) : (
                        <button
                            type="button"
                            className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground"
                            aria-label="Clear page search"
                            onClick={() => {
                                setQuery('');
                                filterRef.current?.focus();
                            }}
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent className="gap-0 py-2">
                {filtering && (
                    <p className="px-4 pb-1 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/45 uppercase group-data-[collapsible=icon]:hidden">
                        {matches.length === 0
                            ? 'No pages'
                            : `${matches.length} ${matches.length === 1 ? 'page' : 'pages'}`}
                    </p>
                )}
                {filteredGroups.length === 0 && (
                    <p className="px-4 py-6 text-xs text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
                        Nothing matches "{query.trim()}".
                    </p>
                )}
                {filteredGroups.map((group) => {
                    const code = String(
                        visibleGroups.findIndex(
                            (item) => item.label === group.label,
                        ) + 1,
                    ).padStart(2, '0');
                    const open = sectionOpen(group.label);

                    return (
                        <Collapsible
                            key={group.label}
                            open={open}
                            onOpenChange={(next) =>
                                toggleSection(group.label, next)
                            }
                        >
                            <SidebarGroup className="px-2 py-1">
                                <SidebarGroupLabel
                                    asChild
                                    className="h-7 w-full cursor-pointer rounded-sm px-1.5 text-[0.65rem] font-semibold tracking-[0.16em] text-sidebar-foreground/50 uppercase hover:bg-sidebar-accent hover:text-sidebar-foreground data-[state=open]:[&>svg]:rotate-90"
                                >
                                    <CollapsibleTrigger>
                                        <span className="text-sidebar-primary/80 tabular-nums">
                                            {code}
                                        </span>
                                        <span className="truncate">
                                            {group.label}
                                        </span>
                                        <span className="ml-auto text-[10px] font-medium text-sidebar-foreground/35 tabular-nums">
                                            {group.items.length}
                                        </span>
                                        <ChevronRight className="text-sidebar-foreground/40 transition-transform" />
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>
                                <CollapsibleContent>
                                    <SidebarGroupContent>
                                        <SidebarMenu className="gap-0.5">
                                            {group.items.map((item) => {
                                                const statusLabel =
                                                    item.status === 'partial'
                                                        ? 'Partial'
                                                        : item.status ===
                                                            'planned'
                                                          ? 'Planned'
                                                          : null;
                                                const pointed =
                                                    filtering &&
                                                    matches[cursor] === item;

                                                return (
                                                    <SidebarMenuItem
                                                        key={item.title}
                                                    >
                                                        <SidebarMenuButton
                                                            asChild
                                                            isActive={active(
                                                                item,
                                                            )}
                                                            tooltip={{
                                                                children:
                                                                    statusLabel
                                                                        ? `${item.title} (${statusLabel})`
                                                                        : item.title,
                                                            }}
                                                            className={
                                                                pointed
                                                                    ? `${itemClassName} bg-sidebar-accent text-sidebar-foreground`
                                                                    : itemClassName
                                                            }
                                                        >
                                                            <Link
                                                                href={item.href}
                                                                prefetch
                                                            >
                                                                {item.icon && (
                                                                    <item.icon />
                                                                )}
                                                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                                                    <span className="min-w-0 truncate">
                                                                        {
                                                                            item.title
                                                                        }
                                                                    </span>
                                                                    {statusLabel && (
                                                                        <span
                                                                            className={
                                                                                item.status ===
                                                                                'partial'
                                                                                    ? 'ml-auto shrink-0 bg-warning/20 px-1 py-px text-[9px] font-semibold tracking-wider text-warning uppercase group-data-[collapsible=icon]:hidden'
                                                                                    : 'ml-auto shrink-0 bg-sidebar-foreground/10 px-1 py-px text-[9px] font-semibold tracking-wider text-sidebar-foreground/55 uppercase group-data-[collapsible=icon]:hidden'
                                                                            }
                                                                        >
                                                                            {
                                                                                statusLabel
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </Link>
                                                        </SidebarMenuButton>
                                                    </SidebarMenuItem>
                                                );
                                            })}
                                        </SidebarMenu>
                                    </SidebarGroupContent>
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>
                    );
                })}
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
