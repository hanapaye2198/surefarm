import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones = {
    neutral: {
        bar: 'bg-foreground/30',
        plate: 'border-border bg-muted text-foreground',
    },
    info: {
        bar: 'bg-primary',
        plate: 'border-primary/25 bg-primary/10 text-primary',
    },
    success: {
        bar: 'bg-primary',
        plate: 'border-primary/25 bg-primary/10 text-primary',
    },
    warning: {
        bar: 'bg-warning',
        plate: 'border-warning/35 bg-warning/10 text-warning-foreground',
    },
    critical: {
        bar: 'bg-destructive',
        plate: 'border-destructive/30 bg-destructive/10 text-destructive',
    },
} as const;

export type NoticeTone = keyof typeof tones;

export function OpsNotice({
    tone = 'info',
    title,
    description,
    meta,
    icon: Icon,
    action,
    bare = false,
    className,
}: {
    tone?: NoticeTone;
    title: string;
    description?: string | null;
    meta?: string | null;
    icon?: LucideIcon;
    action?: ReactNode;
    bare?: boolean;
    className?: string;
}) {
    const style = tones[tone];

    return (
        <div
            className={cn(
                'flex gap-3 px-4 py-3 sm:px-5',
                bare ? 'bg-transparent' : 'border border-border/80 bg-card',
                className,
            )}
        >
            <span className={cn('w-0.5 shrink-0 self-stretch', style.bar)} />
            {Icon && (
                <span
                    className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center border',
                        style.plate,
                    )}
                >
                    <Icon className="size-4" strokeWidth={1.75} />
                </span>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-snug font-medium">{title}</p>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
                {description && (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {description}
                    </p>
                )}
                {meta && (
                    <p className="mt-1.5 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                        {meta}
                    </p>
                )}
            </div>
        </div>
    );
}
