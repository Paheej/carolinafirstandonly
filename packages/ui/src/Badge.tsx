import * as React from 'react';
import { cn } from '@cfo/shared';

type Variant = 'default' | 'gold' | 'mat' | 'danger' | 'success' | 'info' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: Variant;
    size?: Size;
}

const variantClasses: Record<Variant, string> = {
    default: 'bg-primer text-graphite-soft border-graphite/15',
    gold: 'cfo-badge-gold bg-gold-bright/30 text-graphite border-gold/60',
    mat: 'bg-mat text-on-mat border-mat',
    danger: 'bg-casualty text-primer-lift border-casualty',
    success: 'bg-success text-primer-lift border-success',
    info: 'bg-info text-primer-lift border-info',
    outline: 'bg-transparent text-current border-current/40',
};

const sizeClasses: Record<Size, string> = {
    sm: 'h-6 px-2 text-[0.8rem]',
    md: 'h-7 px-2.5 text-sm',
    lg: 'h-8 px-3 text-[0.95rem]',
};

export function Badge({ className, variant = 'default', size = 'sm', ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                'cfo-ui inline-flex items-center justify-center gap-1 rounded-[3px] border font-semibold',
                'whitespace-nowrap leading-none',
                variantClasses[variant],
                sizeClasses[size],
                className,
            )}
            {...props}
        />
    );
}
