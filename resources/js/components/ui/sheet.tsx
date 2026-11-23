import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetOverlay = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn('fixed inset-0 z-50 bg-zinc-950/40 dark:bg-black/65', className)}
        {...props}
    />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const SheetContent = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
        <SheetOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[460px] flex-col border-l border-zinc-200 bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900',
                className,
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close
                aria-label="Close"
                className="absolute right-3.5 top-3.5 rounded-sm p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700 cursor-pointer"
            >
                <X className="h-4 w-4" />
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('flex flex-col gap-1 border-b border-zinc-200 dark:border-zinc-800 px-5 py-4', className)}
            {...props}
        />
    );
}

export const SheetTitle = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100', className)}
        {...props}
    />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-xs text-zinc-500 dark:text-zinc-400', className)}
        {...props}
    />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'mt-auto flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/60',
                className,
            )}
            {...props}
        />
    );
}
