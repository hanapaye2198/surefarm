import { Link } from '@inertiajs/react';
import { StatusBadge } from '@/components/status-badge';
import type { FarmStatus } from '@/components/status-badge';

export type WorkQueueItem = {
    status: FarmStatus;
    label: string;
    count: number;
    href: string;
};

const countFormatter = new Intl.NumberFormat('en-US');

export function WorkQueue({ items }: { items: WorkQueueItem[] }) {
    const waiting = items.reduce((total, item) => total + item.count, 0);

    return (
        <div className="grid gap-3">
            {waiting === 0 && (
                <p className="text-sm text-muted-foreground">
                    No farms are waiting on verification.
                </p>
            )}
            <ul className="flex flex-col">
                {items.map((item) => (
                    <li
                        key={item.status}
                        className="border-b last:border-b-0"
                    >
                        <Link
                            href={item.href}
                            className="flex items-center justify-between gap-3 rounded-md py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <span className="flex min-w-0 flex-col gap-1">
                                <StatusBadge status={item.status} />
                                <span className="text-sm text-muted-foreground">
                                    {item.label}
                                </span>
                            </span>
                            <span className="text-lg font-semibold tabular-nums">
                                {countFormatter.format(item.count)}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
