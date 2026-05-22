import * as React from 'react';
import { cn } from '@cfo/shared';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-sm bg-parchment-dark/70',
                'border border-brass-dark/20',
                className,
            )}
            aria-hidden="true"
            {...props}
        />
    );
}
