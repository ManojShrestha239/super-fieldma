import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
    {
        variants: {
            variant: {
                default:
                    'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100 dark:hover:bg-white',
                secondary:
                    'bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:border-zinc-700',
                ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
                destructive:
                    'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500 dark:border-rose-600',
            },
            size: {
                default: 'h-8 px-3',
                sm: 'h-7 px-2.5 text-[11px]',
                icon: 'h-7 w-7',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
    },
);
Button.displayName = 'Button';
