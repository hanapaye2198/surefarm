import { router } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type AppNotification = {
    id: string;
    title: string;
    message: string;
    created_at: string | null;
    read: boolean;
    href: string | null;
};

type NotificationResponse = {
    available: boolean;
    unread_count: number;
    notifications: AppNotification[];
};

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
                    className="relative shrink-0 rounded-lg"
                    aria-label={
                        unread > 0
                            ? `Notifications, ${unread} unread`
                            : 'Notifications'
                    }
                >
                    <Bell />
                    {unread > 0 && (
                        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {state === 'loading' && (
                    <p className="px-2 py-4 text-sm text-muted-foreground">
                        Loading notifications...
                    </p>
                )}
                {state === 'error' && (
                    <p className="px-2 py-4 text-sm text-destructive">
                        Notifications could not be loaded.
                    </p>
                )}
                {state === 'ready' && payload?.notifications.length === 0 && (
                    <p className="px-2 py-4 text-sm text-muted-foreground">
                        No notifications for your account.
                    </p>
                )}
                {state === 'ready' &&
                    payload?.notifications.map((notification) => (
                        <button
                            key={notification.id}
                            type="button"
                            className={cn(
                                'flex w-full flex-col gap-1 px-2 py-2.5 text-left text-sm hover:bg-accent',
                                !notification.read && 'bg-muted/60',
                            )}
                            onClick={() => void openNotification(notification)}
                        >
                            <span className="font-medium">
                                {notification.title}
                            </span>
                            {notification.message !== '' && (
                                <span className="text-muted-foreground">
                                    {notification.message}
                                </span>
                            )}
                            {notification.created_at && (
                                <span className="text-xs text-muted-foreground">
                                    {notification.created_at}
                                </span>
                            )}
                        </button>
                    ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
