import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export function ConfirmAction({
    open,
    title,
    description,
    confirmLabel,
    pendingLabel = 'Saving...',
    pending = false,
    destructive = false,
    onOpenChange,
    onConfirm,
    children,
}: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    pendingLabel?: string;
    pending?: boolean;
    destructive?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    children?: ReactNode;
}) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!pending) {
                    onOpenChange(next);
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {children}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={pending}
                        onClick={onConfirm}
                    >
                        {pending ? pendingLabel : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
