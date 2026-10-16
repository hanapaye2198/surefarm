import { Link, type InertiaLinkProps } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';

const titleNames = ['Lot', 'Activity', 'Name', 'Farm', 'Farmer', 'Type'];

export function DataTable({
    columns,
    rows,
    emptyTitle,
    emptyDescription,
    emptyAction,
}: {
    columns: string[];
    rows?: {
        id: string | number;
        href?: NonNullable<InertiaLinkProps['href']>;
        cells: ReactNode[];
    }[];
    emptyTitle: string;
    emptyDescription: string;
    emptyAction?: ReactNode;
}) {
    const hasRows = rows !== undefined && rows.length > 0;
    const actionIndex = columns.findIndex((column) => column === 'Actions');
    const titleIndex =
        titleNames
            .map((name) => columns.indexOf(name))
            .find((index) => index >= 0) ?? 0;

    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {hasRows ? (
                <div className="divide-y lg:hidden">
                    {rows.map((row) => (
                        <article key={row.id} className="grid gap-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 text-sm font-medium">
                                    {renderCell(
                                        row.cells[titleIndex],
                                        row.href,
                                    )}
                                </div>
                                {actionIndex >= 0 && (
                                    <div className="shrink-0 [&_a]:min-h-10 [&_button]:min-h-10">
                                        {row.cells[actionIndex]}
                                    </div>
                                )}
                            </div>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                                {columns.map((column, index) => {
                                    if (
                                        index === titleIndex ||
                                        index === actionIndex
                                    ) {
                                        return null;
                                    }

                                    return (
                                        <div
                                            key={`${row.id}-${column}`}
                                            className="min-w-0"
                                        >
                                            <dt className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                                                {column}
                                            </dt>
                                            <dd className="text-sm break-words">
                                                {row.cells[index]}
                                            </dd>
                                        </div>
                                    );
                                })}
                            </dl>
                        </article>
                    ))}
                </div>
            ) : null}

            <div
                className={cn(
                    'app-scroll overflow-x-auto',
                    hasRows && 'hidden lg:block',
                )}
            >
                <table className="w-full min-w-max caption-bottom text-sm">
                    <thead className="border-b bg-muted/50">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column}
                                    className="h-11 px-4 text-left align-middle text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
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
                                            {index === titleIndex
                                                ? renderCell(cell, row.href)
                                                : cell}
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

function renderCell(
    cell: ReactNode,
    href?: NonNullable<InertiaLinkProps['href']>,
): ReactNode {
    if (!href || typeof cell !== 'string') {
        return cell;
    }

    return (
        <Link
            href={href}
            className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {cell}
        </Link>
    );
}
