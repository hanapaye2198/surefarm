import type { ReactNode } from 'react';

export function SectionHeader({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {action}
        </div>
    );
}
