import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
    meta,
    detailsClassName,
    metaClassName,
}: {
    user: User;
    showEmail?: boolean;
    meta?: string;
    detailsClassName?: string;
    metaClassName?: string;
}) {
    const getInitials = useInitials();

    return (
        <>
            <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div
                className={cn(
                    'grid min-w-0 flex-1 text-left text-sm leading-tight',
                    detailsClassName,
                )}
            >
                <span className="truncate font-medium">{user.name}</span>
                {showEmail && (
                    <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                    </span>
                )}
                {meta && (
                    <span
                        className={cn(
                            'truncate text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase',
                            metaClassName,
                        )}
                    >
                        {meta}
                    </span>
                )}
            </div>
        </>
    );
}
