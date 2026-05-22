import * as React from 'react';
import { cn } from '@cfo/shared';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
}

const variantClass: Record<Variant, string> = {
    primary: 'cfo-btn--primary',
    secondary: 'cfo-btn--secondary',
    ghost: 'cfo-btn--ghost',
    danger: 'cfo-btn--danger',
};

const sizeClass: Record<Size, string> = {
    sm: 'cfo-btn--sm',
    md: 'cfo-btn--md',
    lg: 'cfo-btn--lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
        <button
            ref={ref}
            className={cn('cfo-btn', variantClass[variant], sizeClass[size], className)}
            {...props}
        />
    ),
);
Button.displayName = 'Button';
