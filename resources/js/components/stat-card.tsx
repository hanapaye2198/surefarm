import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StatCard({
    label,
    value,
    detail,
    icon: Icon,
}: {
    label: ReactNode;
    value: ReactNode;
    detail?: string;
    icon?: LucideIcon;
}) {
    return (
        <Card className="gap-2 py-4 shadow-sm sm:py-5">
            <CardHeader className="gap-2 px-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-xs leading-snug font-medium text-muted-foreground sm:text-sm">
                        {label}
                    </p>
                    {Icon && (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="size-4" />
                        </span>
                    )}
                </div>
                <CardTitle className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                    {value}
                </CardTitle>
            </CardHeader>
            {detail && (
                <CardContent className="px-4 text-xs text-muted-foreground sm:px-5">
                    {detail}
                </CardContent>
            )}
        </Card>
    );
}
