import * as React from 'react';
import { cn } from '@cfo/shared';

const fieldClasses = cn(
    'w-full rounded-[3px] border border-graphite/25 bg-primer-lift px-3 py-2 text-graphite',
    'placeholder:text-graphite-soft/70',
    'focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/40',
    'disabled:cursor-not-allowed disabled:opacity-50',
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

export const Select = React.forwardRef<
    HTMLSelectElement,
    React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
    <select ref={ref} className={cn(fieldClasses, 'h-10 pr-8', className)} {...props} />
));
Select.displayName = 'Select';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export function Label({ className, required, children, ...props }: LabelProps) {
    return (
        <label
            className={cn('cfo-ui mb-1 block text-[0.95rem] font-semibold text-graphite', className)}
            {...props}
        >
            {children}
            {required ? <span className="ml-0.5 text-casualty">*</span> : null}
        </label>
    );
}
