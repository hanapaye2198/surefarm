import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
    pending: 'border-transparent bg-muted text-muted-foreground',
    in_progress: 'border-transparent bg-primary/15 text-primary',
    verified: 'border-transparent bg-primary text-primary-foreground',
    needs_review: 'border-transparent bg-secondary text-secondary-foreground',
    failed: 'border-transparent bg-destructive/10 text-destructive',
} as const;

const statusLabels = {
    pending: 'Pending',
    in_progress: 'In progress',
    verified: 'Verified',
    needs_review: 'Needs review',
    failed: 'Failed',
} as const;

export type FarmStatus = keyof typeof statusStyles;

export function StatusBadge({
    status,
    className,
}: {
    status: FarmStatus;
    className?: string;
}) {
    return (
        <Badge className={cn('uppercase', statusStyles[status], className)}>
            {statusLabels[status]}
        </Badge>
    );
}

const farmerStatusStyles = {
    active: 'border-transparent bg-primary text-primary-foreground',
    inactive: 'border-transparent bg-muted text-muted-foreground',
    pending: 'border-transparent bg-secondary text-secondary-foreground',
    harvesting: 'border-transparent bg-primary/15 text-primary',
    under_development: 'border-transparent bg-secondary text-secondary-foreground',
} as const;

const farmerStatusLabels = {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    harvesting: 'Harvesting',
    under_development: 'Under development',
} as const;

export type FarmerRecordStatus = keyof typeof farmerStatusStyles;

export function FarmerStatusBadge({
    status,
    className,
}: {
    status: FarmerRecordStatus;
    className?: string;
}) {
    return (
        <Badge className={cn('uppercase', farmerStatusStyles[status], className)}>
            {farmerStatusLabels[status]}
        </Badge>
    );
}

const activityStatusStyles = {
    planned: 'border-transparent bg-muted text-muted-foreground',
    in_progress: 'border-transparent bg-primary/15 text-primary',
    completed: 'border-transparent bg-primary text-primary-foreground',
    cancelled: 'border-transparent bg-destructive/10 text-destructive',
} as const;

const activityStatusLabels = {
    planned: 'Planned',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
} as const;

export type ActivityRecordStatus = keyof typeof activityStatusStyles;

export function ActivityStatusBadge({
    status,
    className,
}: {
    status: ActivityRecordStatus;
    className?: string;
}) {
    return (
        <Badge
            className={cn('uppercase', activityStatusStyles[status], className)}
        >
            {activityStatusLabels[status]}
        </Badge>
    );
}

const productionStatusStyles = {
    planned: 'border-transparent bg-muted text-muted-foreground',
    active: 'border-transparent bg-primary/15 text-primary',
    completed: 'border-transparent bg-primary text-primary-foreground',
} as const;

const productionStatusLabels = {
    planned: 'Planned',
    active: 'Active',
    completed: 'Completed',
} as const;

export type ProductionRecordStatus = keyof typeof productionStatusStyles;

export function ProductionStatusBadge({
    status,
    className,
}: {
    status: ProductionRecordStatus;
    className?: string;
}) {
    return (
        <Badge
            className={cn('uppercase', productionStatusStyles[status], className)}
        >
            {productionStatusLabels[status]}
        </Badge>
    );
}

export type HarvestRecordStatus = ActivityRecordStatus;

export function HarvestStatusBadge({
    status,
    className,
}: {
    status: HarvestRecordStatus;
    className?: string;
}) {
    return <ActivityStatusBadge status={status} className={className} />;
}

const inventoryStatusStyles = {
    available: 'border-transparent bg-primary text-primary-foreground',
    reserved: 'border-transparent bg-secondary text-secondary-foreground',
    processing: 'border-transparent bg-primary/15 text-primary',
    damaged: 'border-transparent bg-destructive/10 text-destructive',
    expired: 'border-transparent bg-muted text-muted-foreground',
    released: 'border-transparent bg-muted text-muted-foreground',
} as const;

export type InventoryRecordStatus = keyof typeof inventoryStatusStyles;

export function InventoryStatusBadge({
    status,
    className,
}: {
    status: InventoryRecordStatus;
    className?: string;
}) {
    return (
        <Badge className={cn('uppercase', inventoryStatusStyles[status], className)}>
            {status.replaceAll('_', ' ')}
        </Badge>
    );
}

const traceabilityStatusStyles = {
    active: 'border-transparent bg-primary text-primary-foreground',
    processing: 'border-transparent bg-primary/15 text-primary',
    completed: 'border-transparent bg-secondary text-secondary-foreground',
    released: 'border-transparent bg-muted text-muted-foreground',
    cancelled: 'border-transparent bg-destructive/10 text-destructive',
} as const;

export type TraceabilityRecordStatus = keyof typeof traceabilityStatusStyles;

export function TraceabilityStatusBadge({
    status,
    className,
}: {
    status: TraceabilityRecordStatus;
    className?: string;
}) {
    return (
        <Badge className={cn('uppercase', traceabilityStatusStyles[status], className)}>
            {status.replaceAll('_', ' ')}
        </Badge>
    );
}
