import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchResult = {
    type: 'farmer' | 'farm';
    id: number;
    title: string;
    subtitle: string;
    href: string;
};

type SearchResponse = {
    available: boolean;
    results: SearchResult[];
    message: string | null;
};

export function GlobalSearch({ autoFocus = false }: { autoFocus?: boolean }) {
    const listId = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<SearchResponse | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const requestId = useRef(0);

    useEffect(() => {
        const term = query.trim();

        if (term.length < 2) {
            setPayload(null);
            setError(null);
            setLoading(false);
            setActiveIndex(0);

            return;
        }

        const controller = new AbortController();
        const current = ++requestId.current;
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError(null);

            fetch(`/search?q=${encodeURIComponent(term)}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error('Search failed');
                    }

                    return (await response.json()) as SearchResponse;
                })
                .then((body) => {
                    if (current !== requestId.current) {
                        return;
                    }

                    setPayload(body);
                    setActiveIndex(0);
                })
                .catch((reason: unknown) => {
                    if (
                        reason instanceof DOMException &&
                        reason.name === 'AbortError'
                    ) {
                        return;
                    }

                    if (current !== requestId.current) {
                        return;
                    }

                    setError('Search could not be completed.');
                    setPayload(null);
                })
                .finally(() => {
                    if (current === requestId.current) {
                        setLoading(false);
                    }
                });
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const results = payload?.results ?? [];

    function openResult(result: SearchResult) {
        setOpen(false);
        router.visit(result.href);
    }

    return (
        <div className="relative w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                autoFocus={autoFocus}
                type="search"
                value={query}
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                placeholder="Search farmers, farms, locations..."
                aria-label="Search farmers, farms, or locations"
                className="h-10 rounded-full border-transparent bg-muted/80 pr-4 pl-10 shadow-none focus-visible:border-input focus-visible:bg-background md:text-sm"
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        setOpen(false);

                        return;
                    }

                    if (!open || results.length === 0) {
                        return;
                    }

                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveIndex((index) => (index + 1) % results.length);
                    }

                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveIndex(
                            (index) =>
                                (index - 1 + results.length) % results.length,
                        );
                    }

                    if (event.key === 'Enter' && results[activeIndex]) {
                        event.preventDefault();
                        openResult(results[activeIndex]);
                    }
                }}
            />
            {open && query.trim().length > 0 && (
                <div
                    id={listId}
                    role="listbox"
                    className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-40 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md"
                >
                    {query.trim().length < 2 && (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                            Type at least 2 characters.
                        </p>
                    )}
                    {loading && query.trim().length >= 2 && (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                            Searching...
                        </p>
                    )}
                    {error && (
                        <p className="px-3 py-3 text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    {!loading && !error && payload?.available === false && (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                            {payload.message}
                        </p>
                    )}
                    {!loading &&
                        !error &&
                        payload?.available !== false &&
                        query.trim().length >= 2 &&
                        results.length === 0 &&
                        payload !== null && (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                                No farmers or farms match that search.
                            </p>
                        )}
                    {results.map((result, index) => (
                        <button
                            key={`${result.type}-${result.id}`}
                            type="button"
                            role="option"
                            aria-selected={index === activeIndex}
                            className={cn(
                                'flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-accent',
                                index === activeIndex && 'bg-accent',
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => openResult(result)}
                        >
                            <span className="font-medium">{result.title}</span>
                            <span className="text-xs text-muted-foreground">
                                {result.type === 'farmer' ? 'Farmer' : 'Farm'}
                                {' · '}
                                {result.subtitle}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
