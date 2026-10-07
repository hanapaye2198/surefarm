import type { UserRole } from '@/types';

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
