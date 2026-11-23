import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export const AlertDialogOverlay = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Overlay
        ref={ref}
        className={cn('fixed inset-0 z-50 bg-zinc-950/45 dark:bg-black/70', className)}
        {...props}
    />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

export const AlertDialogContent = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Portal>
        <AlertDialogOverlay />
        <AlertDialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-zinc-200 bg-white p-5 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900',
                className,
            )}
            {...props}
        />
    </AlertDialogPrimitive.Portal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

export const AlertDialogTitle = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Title
        ref={ref}
        className={cn('text-sm font-semibold text-zinc-900 dark:text-zinc-100', className)}
        {...props}
    />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

export const AlertDialogDescription = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description
        ref={ref}
        className={cn('mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400', className)}
        {...props}
    />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export const AlertDialogAction = AlertDialogPrimitive.Action;
