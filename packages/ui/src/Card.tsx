import * as React from 'react';
import { cn } from '@cfo/shared';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Clickable surface: border darkens on hover. */
    interactive?: boolean;
}

/** A raised panel on the primer page. Use sparingly — lists don't need cards. */
export function Card({ className, interactive, ...props }: CardProps) {
    return (
        <div
            className={cn(
                'relative rounded-[3px] border border-graphite/10 bg-primer-lift',
                interactive && 'transition-colors hover:border-graphite/40 cursor-pointer',
                className,
            )}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('border-b border-graphite/10 px-6 py-4', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('px-6 py-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('border-t border-graphite/10 px-6 py-4', className)} {...props} />;
}
