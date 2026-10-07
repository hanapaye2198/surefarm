import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';

export function DataTable({
    columns,
    rows,
    emptyTitle,
    emptyDescription,
    emptyAction,
}: {
    columns: string[];
    rows?: { id: string | number; cells: ReactNode[] }[];
    emptyTitle: string;
    emptyDescription: string;
    emptyAction?: ReactNode;
}) {
    const hasRows = rows !== undefined && rows.length > 0;

    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="app-scroll overflow-x-auto">
                <table className="w-full min-w-max caption-bottom text-sm">
                    <thead className="border-b bg-muted/50">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column}
                                    className={cn(
                                        'h-11 px-4 text-left align-middle text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase',
                                    )}
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {hasRows ? (
                            rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                                >
                                    {row.cells.map((cell, index) => (
                                        <td
                                            key={`${row.id}-${columns[index]}`}
                                            className="px-4 py-3.5 align-middle whitespace-nowrap"
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length}>
                                    <EmptyState
                                        title={emptyTitle}
                                        description={emptyDescription}
                                        action={emptyAction}
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
