import { EmptyState } from '@/components/empty-state';

export type StoredFile = {
    id: string;
    label: string;
    name: string;
    href: string;
    recorded_at: string | null;
};

export function StoredFiles({
    files,
    emptyTitle,
    emptyDescription,
}: {
    files: StoredFile[];
    emptyTitle: string;
    emptyDescription: string;
}) {
    if (files.length === 0) {
        return <EmptyState title={emptyTitle} description={emptyDescription} />;
    }

    return (
        <ul className="divide-y rounded-xl border">
            {files.map((file) => (
                <li
                    key={file.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{file.label}</p>
                        <p className="truncate text-sm text-muted-foreground">
                            {file.name}
                            {file.recorded_at ? ` · ${file.recorded_at}` : ''}
                        </p>
                    </div>
                    <a
                        href={file.href}
                        className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                        Open file
                    </a>
                </li>
            ))}
        </ul>
    );
}
