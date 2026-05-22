import * as React from 'react';
import { cn } from '@cfo/shared';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Adds hover lift + brass-border emphasis. Use for clickable card surfaces
     * (a link wrapping the card, or a card that is itself a button).
     */
    interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
    return (
        <div
            className={cn(
                'relative rounded-sm border border-brass-dark/40 bg-parchment',
                'shadow-[0_1px_0_rgba(176,141,87,0.5),0_4px_14px_-4px_rgba(26,24,21,0.12)]',
                'transition-all duration-150 ease-out',
                interactive &&
                    'hover:-translate-y-0.5 hover:border-brass-dark/70 ' +
                        'hover:shadow-[0_2px_0_rgba(176,141,87,0.6),0_10px_22px_-6px_rgba(26,24,21,0.22)] ' +
                        'cursor-pointer',
                className,
            )}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('border-b border-brass-dark/30 px-6 py-4', className)}
            {...props}
        />
    );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('px-6 py-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('border-t border-brass-dark/30 px-6 py-4', className)}
            {...props}
        />
    );
}
