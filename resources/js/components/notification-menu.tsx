import { router } from '@inertiajs/react';
import {
    Bell,
    CircleCheck,
    Info,
    OctagonAlert,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type NoticeTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

type AppNotification = {
    id: string;
    title: string;
    message: string;
    created_at: string | null;
    read: boolean;
    href: string | null;
    kind?: string;
    tone?: NoticeTone;
};

type NotificationResponse = {
    available: boolean;
    unread_count: number;
    notifications: AppNotification[];
};

const toneRail: Record<NoticeTone, string> = {
    neutral: 'bg-foreground/25',
    info: 'bg-primary',
    success: 'bg-primary',
    warning: 'bg-warning',
    critical: 'bg-destructive',
};

const toneIcon = {
    neutral: Info,
    info: Info,
    success: CircleCheck,
    warning: TriangleAlert,
    critical: OctagonAlert,
} as const;

function xsrfToken(): string {
    const raw = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));

    return raw ? decodeURIComponent(raw.slice('XSRF-TOKEN='.length)) : '';
}

export function NotificationMenu() {
    const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
        'idle',
    );
    const [payload, setPayload] = useState<NotificationResponse | null>(null);

    async function load() {
        setState('loading');

        try {
            const response = await fetch('/notifications', {
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Notifications failed');
            }

            setPayload((await response.json()) as NotificationResponse);
            setState('ready');
        } catch {
            setState('error');
        }
    }

    async function openNotification(notification: AppNotification) {
        if (!notification.read) {
            const response = await fetch(
                `/notifications/${notification.id}/read`,
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': xsrfToken(),
                    },
                },
            );

            if (response.ok) {
                const body = (await response.json()) as {
                    unread_count: number;
                };
                setPayload((current) =>
                    current
                        ? {
                              ...current,
                              unread_count: body.unread_count,
                              notifications: current.notifications.map(
                                  (item) =>
                                      item.id === notification.id
                                          ? { ...item, read: true }
                                          : item,
                              ),
                          }
                        : current,
                );
            }
        }

        if (notification.href) {
            router.visit(notification.href);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    const unread = payload?.unread_count ?? 0;
    const unreadLabel = unread > 9 ? '9+' : String(unread);

    return (
        <DropdownMenu
            onOpenChange={(open) => {
                if (open) {
                    void load();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative size-8 shrink-0 rounded-sm border border-border bg-background"
                    aria-label={
                        unread > 0
                            ? `Notifications, ${unread} unread`
                            : 'Notifications'
                    }
                >
                    <Bell />
                    {unread > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
                            {unreadLabel}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-[min(22rem,calc(100vw-1.5rem))] rounded-lg p-0"
            >
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                            Inbox
                        </p>
                        <p className="mt-0.5 text-sm font-semibold">
                            Notifications
                        </p>
                    </div>
                    <span
                        className={cn(
                            'border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase',
                            unread > 0
                                ? 'border-warning/40 bg-warning/10 text-warning-foreground'
                                : 'border-border bg-muted text-muted-foreground',
                        )}
                    >
                        {unread > 0 ? `${unread} unread` : 'Clear'}
                    </span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {state === 'loading' && payload === null && (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                            Loading notifications
                        </p>
                    )}
                    {state === 'error' && (
                        <div className="px-4 py-6">
                            <p className="text-sm font-medium">
                                Notifications unavailable
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                The inbox could not be loaded. Try again.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => void load()}
                            >
                                Retry
                            </Button>
                        </div>
                    )}
                    {state === 'ready' &&
                        payload?.notifications.length === 0 && (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm font-medium">
                                    Inbox is clear
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    New farm, harvest, and verification updates
                                    will appear here.
                                </p>
                            </div>
                        )}
                    {payload?.notifications.map((notification) => {
                        const tone = notification.tone ?? 'neutral';
                        const Icon = toneIcon[tone] ?? Info;

                        return (
                            <button
                                key={notification.id}
                                type="button"
                                className={cn(
                                    'flex w-full gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/60',
                                    !notification.read && 'bg-muted/40',
                                )}
                                onClick={() =>
                                    void openNotification(notification)
                                }
                            >
                                <span
                                    className={cn(
                                        'mt-0.5 w-0.5 shrink-0 self-stretch',
                                        toneRail[tone],
                                    )}
                                />
                                <span
                                    className={cn(
                                        'mt-0.5 flex size-7 shrink-0 items-center justify-center border',
                                        tone === 'warning' &&
                                            'border-warning/35 bg-warning/10 text-warning-foreground',
                                        tone === 'critical' &&
                                            'border-destructive/30 bg-destructive/10 text-destructive',
                                        tone === 'success' &&
                                            'border-primary/25 bg-primary/10 text-primary',
                                        (tone === 'info' ||
                                            tone === 'neutral') &&
                                            'border-border bg-muted text-foreground',
                                    )}
                                >
                                    <Icon className="size-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-start justify-between gap-2">
                                        <span className="text-sm leading-snug font-medium">
                                            {notification.title}
                                        </span>
                                        {!notification.read && (
                                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                        )}
                                    </span>
                                    {notification.message !== '' && (
                                        <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                                            {notification.message}
                                        </span>
                                    )}
                                    {notification.created_at && (
                                        <span className="mt-1.5 block text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                            {notification.created_at}
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
