import { Link, usePage } from '@inertiajs/react';
import {
    BadgeCheck,
    BarChart3,
    Factory,
    QrCode,
    Handshake,
    Landmark,
    LayoutGrid,
    ListChecks,
    MapPinned,
    Settings,
    Shield,
    Sprout,
    Truck,
    Users,
    Warehouse,
    Wheat,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { userCanAccess } from '@/lib/access';
import { dashboard } from '@/routes';
import { index as farmersIndex } from '@/routes/farmers';
import { index as activitiesIndex } from '@/routes/farm-activities';
import { index as harvestIndex } from '@/routes/harvest';
import { index as inventoryIndex, processing as processingIndex } from '@/routes/inventory';
import { index as traceabilityIndex } from '@/routes/traceability';
import { index as productionIndex } from '@/routes/production';
import { index as farmVerificationIndex } from '@/routes/farm-verification';
import { index as farmsIndex } from '@/routes/farms';
import { show as showModule } from '@/routes/modules';
import { index as activityTypesIndex } from '@/routes/activity-types';
import { edit as editProfile } from '@/routes/profile';
import type { NavItem, UserRole } from '@/types';

type SidebarLink = NavItem & {
    roles?: UserRole[];
    match?: 'exact' | 'parent' | 'settings';
};

const itemClassName =
    'h-10 rounded-lg px-2.5 text-sidebar-foreground/85 data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary lg:h-9';

const groups: { label: string; items: SidebarLink[] }[] = [
    {
        label: 'Overview',
        items: [
            {
                title: 'Dashboard',
                href: dashboard(),
                icon: LayoutGrid,
                match: 'exact',
            },
        ],
    },
    {
        label: 'Registry',
        items: [
            {
                title: 'Farmers',
                href: farmersIndex(),
                icon: Users,
                roles: ['operations', 'field_verifier'],
                match: 'parent',
            },
            {
                title: 'Farms & Map',
                href: farmsIndex(),
                icon: MapPinned,
                roles: ['operations', 'field_verifier'],
                match: 'parent',
            },
            {
                title: 'Farm Verification',
                href: farmVerificationIndex(),
                icon: BadgeCheck,
                roles: ['field_verifier'],
                match: 'parent',
            },
            {
                title: 'Cooperatives',
                href: showModule('cooperatives'),
                icon: Handshake,
            },
        ],
    },
    {
        label: 'Operations',
        items: [
            {
                title: 'Crop Management',
                href: showModule('crop-management'),
                icon: Sprout,
            },
            {
                title: 'Farm Activities',
                href: activitiesIndex(),
                icon: ListChecks,
                roles: ['operations', 'field_verifier'],
                match: 'parent',
            },
            {
                title: 'Production',
                href: productionIndex(),
                icon: Wheat,
                roles: ['operations', 'field_verifier'],
                match: 'parent',
            },
            {
                title: 'Harvest',
                href: harvestIndex(),
                icon: Wheat,
                roles: ['operations', 'field_verifier'],
                match: 'parent',
            },
        ],
    },
    {
        label: 'Business',
        items: [
            {
                title: 'Inventory',
                href: inventoryIndex(),
                icon: Warehouse,
                roles: ['operations', 'field_verifier'],
                match: 'parent',
            },
            {
                title: 'Coffee Processing',
                href: processingIndex(),
                icon: Factory,
                roles: ['operations', 'field_verifier'],
            },
            {
                title: 'Traceability',
                href: traceabilityIndex(),
                icon: QrCode,
                roles: ['operations', 'field_verifier'],
                match: 'parent',
            },
            {
                title: 'Finance',
                href: showModule('finance'),
                icon: Landmark,
            },
            {
                title: 'Insurance',
                href: showModule('insurance'),
                icon: Shield,
            },
            {
                title: 'Logistics & Export',
                href: showModule('logistics-export'),
                icon: Truck,
            },
        ],
    },
    {
        label: 'System',
        items: [
            {
                title: 'Reports',
                href: showModule('reports'),
                icon: BarChart3,
            },
            {
                title: 'Activity Types',
                href: activityTypesIndex(),
                icon: ListChecks,
                roles: ['admin'],
                match: 'parent',
            },
            {
                title: 'Settings',
                href: editProfile(),
                icon: Settings,
                match: 'settings',
            },
        ],
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;
    const { currentUrl, isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();
    const role = auth.user?.role;

    function active(item: SidebarLink): boolean {
        if (item.match === 'settings') {
            return (
                currentUrl.startsWith('/settings') &&
                !currentUrl.startsWith('/settings/activity-types')
            );
        }

        if (item.match === 'parent') {
            return isCurrentOrParentUrl(item.href);
        }

        return isCurrentUrl(item.href);
    }

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            className="h-auto rounded-xl py-1.5 hover:bg-white/10"
                            asChild
                        >
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-1 py-2">
                {groups.map((group) => (
                    <SidebarGroup key={group.label} className="px-2 py-1">
                        <SidebarGroupLabel className="h-7 px-2.5 text-[0.68rem] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
                            {group.label}
                        </SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map((item) => {
                                if (
                                    item.roles?.length === 1 &&
                                    item.roles[0] === 'admin' &&
                                    role !== 'admin'
                                ) {
                                    return null;
                                }

                                if (!userCanAccess(role, item.roles)) {
                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                tooltip="Not available for your role"
                                                className={itemClassName}
                                                aria-disabled
                                                disabled
                                            >
                                                {item.icon && <item.icon />}
                                                <span>{item.title}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                }

                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={active(item)}
                                            tooltip={{ children: item.title }}
                                            className={itemClassName}
                                        >
                                            <Link href={item.href} prefetch>
                                                {item.icon && <item.icon />}
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
