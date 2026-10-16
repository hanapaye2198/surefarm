import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export function sectionTabId(prefix: string, value: string): string {
    return `${prefix}-tab-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function sectionPanelId(prefix: string, value: string): string {
    return `${prefix}-panel-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function SectionTabs<T extends string>({
    tabs,
    value,
    onValueChange,
    label,
    idPrefix,
}: {
    tabs: readonly { value: T; label: string }[];
    value: T;
    onValueChange: (value: T) => void;
    label: string;
    idPrefix: string;
}) {
    const buttons = useRef<Array<HTMLButtonElement | null>>([]);

    function move(event: KeyboardEvent<HTMLDivElement>, direction: 1 | -1) {
        event.preventDefault();
        const index = tabs.findIndex((tab) => tab.value === value);
        const next = (index + direction + tabs.length) % tabs.length;
        onValueChange(tabs[next].value);
        buttons.current[next]?.focus();
    }

    return (
        <div
            role="tablist"
            aria-label={label}
            className="flex gap-1 overflow-x-auto border-b"
            onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                    move(event, 1);
                }

                if (event.key === 'ArrowLeft') {
                    move(event, -1);
                }
            }}
        >
            {tabs.map((tab, index) => {
                const selected = tab.value === value;

                return (
                    <button
                        key={tab.value}
                        ref={(node) => {
                            buttons.current[index] = node;
                        }}
                        id={sectionTabId(idPrefix, tab.value)}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={sectionPanelId(idPrefix, tab.value)}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onValueChange(tab.value)}
                        className={cn(
                            'shrink-0 border-b-2 px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            selected
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground',
                        )}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
