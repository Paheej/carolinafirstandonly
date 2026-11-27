import * as React from 'react';
import { cn } from '@cfo/shared';

export interface FooterProps {
    siteName: string;
    className?: string;
}

export function Footer({ siteName, className }: FooterProps) {
    return (
        <footer className={cn('cfo-on-mat mt-16 bg-mat text-on-mat-soft', className)}>
            <div className="cfo-ui mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-[0.95rem] md:px-6">
                <span>{siteName}. Clemmons, Winston-Salem and around.</span>
                <span className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>Archive since 2021</span>
                    <a href="/privacy" className="text-on-mat-soft underline-offset-4 hover:text-on-mat hover:underline">
                        Privacy
                    </a>
                </span>
            </div>
        </footer>
    );
}
