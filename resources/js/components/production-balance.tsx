import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ProductionBalance({
    expected,
    actual,
    remaining,
    exceeds = false,
    message,
    progress,
    showFigures = true,
}: {
    expected: string;
    actual: string;
    remaining: string;
    exceeds?: boolean;
    message?: string | null;
    progress?: number | null;
    showFigures?: boolean;
}) {
    return (
        <div className="grid gap-3">
            {showFigures && (
                <div className="grid grid-cols-3 divide-x border bg-muted/30">
                    <BalanceStat label="Expected" value={expected} />
                    <BalanceStat label="Actual" value={actual} />
                    <BalanceStat
                        label="Remaining"
                        value={remaining}
                        warning={exceeds}
                    />
                </div>
            )}
            {progress !== null && progress !== undefined && (
                <div className="grid gap-1.5">
                    <div className="flex items-center justify-between text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                        <span>Progress</span>
                        <span className="tabular-nums">{progress}%</span>
                    </div>
                    <div
                        className="h-1.5 overflow-hidden bg-muted"
                        role="img"
                        aria-label={`Harvest progress ${progress}%`}
                    >
                        <div
                            className={
                                exceeds
                                    ? 'h-full bg-warning'
                                    : 'h-full bg-primary'
                            }
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}
            {exceeds && message && (
                <Alert variant="warning">
                    <TriangleAlert />
                    <AlertTitle>Harvest volume exception</AlertTitle>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}

function BalanceStat({
    label,
    value,
    warning = false,
}: {
    label: string;
    value: string;
    warning?: boolean;
}) {
    return (
        <div className="px-3 py-3">
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {label}
            </p>
            <p
                className={
                    warning
                        ? 'mt-1 text-base font-semibold tracking-tight text-warning-foreground tabular-nums sm:text-lg'
                        : 'mt-1 text-base font-semibold tracking-tight tabular-nums sm:text-lg'
                }
            >
                {value}
            </p>
        </div>
    );
}
