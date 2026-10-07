export function ProductionBalance({
    expected,
    actual,
    remaining,
    exceeds = false,
    message,
    progress,
}: {
    expected: string;
    actual: string;
    remaining: string;
    exceeds?: boolean;
    message?: string | null;
    progress?: number | null;
}) {
    return (
        <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
                <BalanceStat label="Expected" value={expected} />
                <BalanceStat label="Actual" value={actual} />
                <BalanceStat label="Remaining" value={remaining} />
            </div>
            {progress !== null && progress !== undefined && (
                <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Harvest progress ${progress}%`}
                >
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
            {exceeds && message && (
                <p className="text-sm text-destructive">{message}</p>
            )}
        </div>
    );
}

function BalanceStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border bg-card px-3 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
    );
}
