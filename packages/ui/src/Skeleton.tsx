import * as React from 'react';
import { cn } from '@cfo/shared';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-[3px] bg-graphite/10', className)}
            aria-hidden="true"
            {...props}
        />
    );
}
