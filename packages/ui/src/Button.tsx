import * as React from 'react';
import { cn } from '@cfo/shared';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * primary = gold (main action, works on mat or primer)
     * secondary = black on primer
     * outline = quiet; graphite on primer, gold inside a MatBand
     */
    variant?: Variant;
    size?: Size;
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
    return cn('cfo-btn', `cfo-btn--${variant}`, `cfo-btn--${size}`, className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
        <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
    ),
);
Button.displayName = 'Button';
