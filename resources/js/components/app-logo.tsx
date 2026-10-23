import { usePage } from '@inertiajs/react';
import { surefarmLogoSrc } from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <img
            src={surefarmLogoSrc}
            alt={name}
            className="h-8 w-auto max-w-[11rem] object-contain object-left group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:max-w-none group-data-[collapsible=icon]:object-cover"
        />
    );
}
