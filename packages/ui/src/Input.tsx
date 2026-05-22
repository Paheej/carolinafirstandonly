import * as React from 'react';
import { cn } from '@cfo/shared';

const fieldClasses = cn(
    'w-full rounded-sm border border-brass-dark/50 bg-parchment/60 px-3 py-2 text-ink',
    'placeholder:text-ink-soft/60',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass',
    'focus-visible:border-brass disabled:cursor-not-allowed disabled:opacity-50',
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
        <input ref={ref} className={cn(fieldClasses, 'h-10', className)} {...props} />
    ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldClasses, 'min-h-[6rem]', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export function Label({ className, required, children, ...props }: LabelProps) {
    return (
        <label
            className={cn(
                'block text-sm font-medium text-ink-soft mb-1',
                className,
            )}
            {...props}
        >
            {children}
            {required ? <span className="text-danger ml-0.5">*</span> : null}
        </label>
    );
}
