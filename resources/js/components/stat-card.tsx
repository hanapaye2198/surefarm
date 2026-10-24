import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const toneBar = {
    neutral: 'bg-foreground/20',
    positive: 'bg-primary',
    warning: 'bg-warning',
    critical: 'bg-destructive',
} as const;

export function StatCard({
    label,
    value,
    detail,
    icon: Icon,
    href,
    tone = 'neutral',
}: {
    label: ReactNode;
    value: ReactNode;
    detail?: string;
    icon?: LucideIcon;
    href?: string;
    tone?: keyof typeof toneBar;
}) {
    const card = (
        <Card className="relative gap-0 overflow-hidden rounded-lg py-0 shadow-none">
            <span
                className={cn('absolute inset-y-0 left-0 w-0.5', toneBar[tone])}
            />
            <CardHeader className="gap-3 px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] leading-snug font-medium tracking-[0.12em] text-muted-foreground uppercase">
                        {label}
                    </p>
                    {Icon && (
                        <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted/70 text-foreground/80">
                            <Icon className="size-4" strokeWidth={1.75} />
                        </span>
                    )}
                </div>
                <CardTitle className="text-xl leading-none font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
                    {value}
                </CardTitle>
            </CardHeader>
            {detail && (
                <CardContent className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                    {detail}
                </CardContent>
            )}
        </Card>
    );

    if (href === undefined) {
        return card;
    }

    return (
        <Link
            href={href}
            className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {card}
        </Link>
    );
}
