'use client';

import { useFormStatus } from 'react-dom';
import { Bot } from 'lucide-react';
import { buttonClasses } from '@cfo/ui';

function Submit({ disabled }: { disabled?: boolean }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className={buttonClasses('primary')} disabled={disabled || pending} aria-live="polite">
            <Bot size={16} /> {pending ? 'Running… (a minute or two)' : 'Run the agent now'}
        </button>
    );
}

export function RunButton({ action, disabled }: { action: () => Promise<void>; disabled?: boolean }) {
    return (
        <form action={action}>
            <Submit disabled={disabled} />
        </form>
    );
}
