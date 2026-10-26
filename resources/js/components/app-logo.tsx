import { usePage } from '@inertiajs/react';
import { surefarmLogoSrc } from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <img
            src={surefarmLogoSrc}
            alt={name}
            className="h-8 w-auto max-w-[10.5rem] rounded-sm bg-white object-contain object-left px-1.5 py-0.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:max-w-none group-data-[collapsible=icon]:object-cover group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:py-0.5"
        />
    );
}
