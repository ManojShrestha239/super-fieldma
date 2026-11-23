import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
    return (
        <input
            type={type}
            className={cn(
                'flex h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-800 dark:disabled:bg-zinc-950 dark:disabled:text-zinc-600',
                className,
            )}
            ref={ref}
            {...props}
        />
    );
});
Input.displayName = 'Input';
