import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data?.message) {
                return;
            }

            const titles = {
                success: 'Completed',
                info: 'Notice',
                warning: 'Attention',
                error: 'Not completed',
            } as const;

            if (!(data.type in titles)) {
                return;
            }

            toast[data.type](titles[data.type], {
                description: data.message,
            });
        });
    }, []);
}
