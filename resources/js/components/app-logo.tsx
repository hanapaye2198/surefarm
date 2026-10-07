import { usePage } from '@inertiajs/react';

import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                <AppLogoIcon className="size-5 fill-current text-sidebar-primary-foreground" />
            </div>
            <div className="ml-1 grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">
                    {name}
                </span>
                <span className="truncate text-[11px] font-normal text-sidebar-foreground/60">
                    Coffee farm operations
                </span>
            </div>
        </>
    );
}
