export const farmStatusColors = {
    verified: '#2f6b45',
    pending: '#d4a017',
    in_progress: '#2563eb',
    needs_review: '#ea580c',
    failed: '#dc2626',
} as const;

export const unknownStatusColor = '#78716c';

export const farmStatusLegend = [
    { status: 'verified', label: 'Verified', color: farmStatusColors.verified },
    { status: 'pending', label: 'Pending verification', color: farmStatusColors.pending },
    { status: 'in_progress', label: 'In progress', color: farmStatusColors.in_progress },
    { status: 'needs_review', label: 'Needs review', color: farmStatusColors.needs_review },
    { status: 'failed', label: 'Failed verification', color: farmStatusColors.failed },
] as const;

export function farmStatusColor(status: string): string {
    if (status in farmStatusColors) {
        return farmStatusColors[status as keyof typeof farmStatusColors];
    }

    return unknownStatusColor;
}

const fieldPalette = ['#16a34a', '#dc2626', '#2563eb', '#ca8a04', '#db2777', '#ea580c', '#0891b2', '#7c3aed'];

export function farmFieldColor(farmId: number): string {
    return fieldPalette[Math.abs(farmId) % fieldPalette.length] ?? fieldPalette[0];
}
