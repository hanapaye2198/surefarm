import {
    BadgeCheck,
    BarChart3,
    Factory,
    QrCode,
    Handshake,
    Landmark,
    LayoutGrid,
    Leaf,
    ListChecks,
    MapPinned,
    Settings,
    Shield,
    Sprout,
    Truck,
    UserCog,
    Users,
    Warehouse,
    Wheat,
} from 'lucide-react';
import { userCanAccess } from '@/lib/access';
import { toUrl } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as farmersIndex } from '@/routes/farmers';
import { index as activitiesIndex } from '@/routes/farm-activities';
import { index as harvestIndex } from '@/routes/harvest';
import {
    index as inventoryIndex,
    processing as processingIndex,
} from '@/routes/inventory';
import { index as traceabilityIndex } from '@/routes/traceability';
import { index as financeIndex } from '@/routes/finance';
import { index as insuranceIndex } from '@/routes/insurance';
import { index as productionIndex } from '@/routes/production';
import { index as farmVerificationIndex } from '@/routes/farm-verification';
import { index as farmsIndex } from '@/routes/farms';
import { index as cooperativesIndex } from '@/routes/cooperatives';
import { show as showModule } from '@/routes/modules';
import { index as activityTypesIndex } from '@/routes/activity-types';
import { edit as editProfile } from '@/routes/profile';
import { index as usersIndex } from '@/routes/users';
import type { NavItem, UserRole } from '@/types';

export type FeatureStatus = 'live' | 'partial' | 'planned';

export type SidebarLink = NavItem & {
    roles?: UserRole[];
    match?: 'exact' | 'parent' | 'settings';
    status?: FeatureStatus;
};

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
                roles: ['operations', 'cooperative_officer'],
                match: 'parent',
            },
            {
                title: 'Farms & Map',
                href: farmsIndex(),
                icon: MapPinned,
                roles: ['operations', 'cooperative_officer'],
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
                href: cooperativesIndex(),
                icon: Handshake,
                roles: ['operations', 'cooperative_officer'],
                match: 'parent',
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
                roles: ['operations'],
                status: 'planned',
            },
            {
                title: 'Farm Activities',
                href: activitiesIndex(),
                icon: ListChecks,
                roles: ['operations'],
                match: 'parent',
            },
            {
                title: 'Production',
                href: productionIndex(),
                icon: Leaf,
                roles: ['operations'],
                match: 'parent',
            },
            {
                title: 'Harvest',
                href: harvestIndex(),
                icon: Wheat,
                roles: ['operations'],
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
                roles: ['operations'],
                match: 'parent',
            },
            {
                title: 'Coffee Processing',
                href: processingIndex(),
                icon: Factory,
                roles: ['operations'],
            },
            {
                title: 'Traceability',
                href: traceabilityIndex(),
                icon: QrCode,
                roles: ['operations'],
                match: 'parent',
            },
            {
                title: 'Finance',
                href: financeIndex(),
                icon: Landmark,
                roles: ['operations'],
                match: 'parent',
                status: 'partial',
            },
            {
                title: 'Crop Insurance',
                href: insuranceIndex(),
                icon: Shield,
                roles: ['operations'],
                match: 'parent',
                status: 'partial',
            },
            {
                title: 'Logistics & Export',
                href: showModule('logistics-export'),
                icon: Truck,
                roles: ['operations'],
                status: 'planned',
            },
        ],
    },
    {
        label: 'System',
        items: [
            {
                title: 'Reports & Analytics',
                href: showModule('reports'),
                icon: BarChart3,
                roles: ['operations'],
                status: 'planned',
            },
            {
                title: 'Activity Types',
                href: activityTypesIndex(),
                icon: ListChecks,
                roles: ['admin'],
                match: 'parent',
            },
            {
                title: 'User Management',
                href: usersIndex(),
                icon: UserCog,
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

function itemPath(item: SidebarLink): string {
    const path = toUrl(item.href).split('?')[0].replace(/\/$/, '');

    return path === '' ? '/' : path;
}

function itemMatches(pathname: string, item: SidebarLink): boolean {
    const href = itemPath(item);

    if (item.match === 'settings') {
        return (
            pathname.startsWith('/settings') &&
            !pathname.startsWith('/settings/activity-types')
        );
    }

    if (item.match === 'parent') {
        return pathname === href || pathname.startsWith(`${href}/`);
    }

    return pathname === href;
}

export function visibleNavigation(role: UserRole | undefined) {
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => userCanAccess(role, item.roles)),
        }))
        .filter((group) => group.items.length > 0);
}

export function winningItem(
    pathname: string,
    navigation: ReturnType<typeof visibleNavigation>,
): SidebarLink | null {
    let winner: SidebarLink | null = null;

    for (const group of navigation) {
        for (const item of group.items) {
            if (!itemMatches(pathname, item)) {
                continue;
            }

            if (
                winner === null ||
                itemPath(item).length > itemPath(winner).length
            ) {
                winner = item;
            }
        }
    }

    return winner;
}

export function navigationSection(
    pathname: string,
    role: UserRole | undefined,
): { code: string; label: string } | null {
    const navigation = visibleNavigation(role);
    const winner = winningItem(pathname, navigation);

    if (winner === null) {
        return null;
    }

    const index = navigation.findIndex((group) => group.items.includes(winner));

    if (index === -1) {
        return null;
    }

    return {
        code: String(index + 1).padStart(2, '0'),
        label: navigation[index].label,
    };
}

