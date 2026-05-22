import * as React from 'react';
import { cn } from '@cfo/shared';

type Variant = 'default' | 'brass' | 'forest' | 'danger' | 'info' | 'leather';
type Size = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: Variant;
    size?: Size;
}

const variantClasses: Record<Variant, string> = {
    default: 'bg-parchment-dark text-ink-soft border-brass-dark/60',
    brass:
        'bg-brass/55 text-ink border-brass-dark ' +
        'shadow-[inset_0_-1px_0_rgba(107,68,35,0.3),inset_0_1px_0_rgba(244,234,213,0.5)]',
    forest:
        'bg-forest text-parchment border-forest-dark ' +
        'shadow-[inset_0_-1px_0_rgba(12,26,13,0.4)]',
    danger:
        'bg-danger text-parchment border-[#5a1c1c] ' +
        'shadow-[inset_0_-1px_0_rgba(90,28,28,0.6)]',
    info:
        'bg-info text-parchment border-[#264058] ' +
        'shadow-[inset_0_-1px_0_rgba(38,64,88,0.6)]',
    leather:
        'bg-leather text-parchment border-[#4a2f18] ' +
        'shadow-[inset_0_-1px_0_rgba(74,47,24,0.6)]',
};

const sizeClasses: Record<Size, string> = {
    sm: 'h-6 px-2.5 text-[11px] uppercase tracking-[0.14em]',
    md: 'h-7 px-3 text-xs uppercase tracking-[0.12em]',
    lg: 'h-8 px-3.5 text-sm',
};

export function Badge({
    className,
    variant = 'default',
    size = 'sm',
    ...props
}: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center justify-center gap-1 rounded-sm border font-semibold',
                'whitespace-nowrap leading-none',
                variantClasses[variant],
                sizeClasses[size],
                className,
            )}
            {...props}
        />
    );
}
