import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { FieldmaInstanceItem } from '@/types/fieldma';

interface DeleteInstanceDialogProps {
    instance: FieldmaInstanceItem | null;
    onClose: () => void;
}

export function DeleteInstanceDialog({ instance, onClose }: DeleteInstanceDialogProps) {
    const [deleting, setDeleting] = useState(false);

    function handleDelete(): void {
        if (!instance) {
            return;
        }

        setDeleting(true);
        router.delete(`/instances/${instance.id}`, {
            preserveScroll: true,
            onFinish: () => {
                setDeleting(false);
                onClose();
            },
        });
    }

    return (
        <AlertDialog open={instance !== null} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogTitle>Delete {instance?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                    This permanently removes <span className="font-mono text-zinc-900">{instance?.slug}</span> from the
                    registry along with all stored daily snapshots. The remote FieldMA database itself is not modified.
                </AlertDialogDescription>
                <div className="mt-5 flex items-center justify-end gap-2">
                    <AlertDialogCancel asChild>
                        <Button type="button" variant="secondary" disabled={deleting}>
                            Cancel
                        </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting...' : 'Delete Instance'}
                        </Button>
                    </AlertDialogAction>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
