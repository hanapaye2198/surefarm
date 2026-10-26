import type { UserRole } from '@/types';

const roleLabels: Record<UserRole, string> = {
    admin: 'Administrator',
    operations: 'Operations',
    field_verifier: 'Field verifier',
    cooperative_officer: 'Cooperative officer',
    farmer: 'Farmer',
};

export function roleLabel(role: UserRole | undefined): string {
    if (!role) {
        return 'Signed in';
    }

    return roleLabels[role];
}

export function userCanAccess(
    role: UserRole | undefined,
    allowed?: UserRole[],
): boolean {
    if (!allowed || allowed.length === 0) {
        return true;
    }

    if (role === 'admin') {
        return true;
    }

    return role !== undefined && allowed.includes(role);
}
