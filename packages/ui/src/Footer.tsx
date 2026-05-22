import * as React from 'react';
import { cn } from '@cfo/shared';

export interface FooterProps {
    siteName: string;
    className?: string;
}

export function Footer({ siteName, className }: FooterProps) {
    const year = new Date().getFullYear();
    return (
        <footer
            className={cn(
                'mt-16 border-t border-brass-dark/40 bg-parchment-dark/40',
                className,
            )}
        >
            <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-soft flex flex-wrap items-center justify-between gap-3">
                <span>
                    © {year} {siteName}. Built by the community.
                </span>
                <span className="text-xs text-ink-soft/70">
                    For the Emperor. And for everyone else playing on the next table over.
                </span>
            </div>
        </footer>
    );
}
