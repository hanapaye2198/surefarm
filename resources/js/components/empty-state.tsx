import type { ReactNode } from 'react';

export function EmptyState({
    title,
    description,
    action,
    icon,
}: {
    title: string;
    description: string;
    action?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            {icon && (
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {icon}
                </div>
            )}
            <div className="space-y-1">
                <h2 className="text-base font-medium">{title}</h2>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
            {action}
        </div>
    );
}
