import * as React from 'react';
import { cn } from '@cfo/shared';

export interface MatBandProps extends React.HTMLAttributes<HTMLElement> {
    as?: 'section' | 'header' | 'div';
    /** Inner content width wrapper classes. */
    innerClassName?: string;
}

/**
 * Full-bleed black "game mat" band. Breaks out of the centered <main>, so a
 * page can open with one directly under the nav.
 */
export function MatBand({ as: Tag = 'section', className, innerClassName, children, ...props }: MatBandProps) {
    return (
        <Tag className={cn('cfo-band', className)} {...props}>
            <div className={cn('mx-auto w-full max-w-6xl px-4 md:px-6', innerClassName)}>{children}</div>
        </Tag>
    );
}

export interface PageHeadProps {
    kicker?: React.ReactNode;
    title: React.ReactNode;
    lede?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
}

/** Standard page opener: a mat band with kicker, big condensed title, lede, actions. */
export function PageHead({ kicker, title, lede, actions, children }: PageHeadProps) {
    return (
        <MatBand as="header" innerClassName="py-10 md:py-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 space-y-3">
                    {kicker ? <div className="cfo-kicker">{kicker}</div> : null}
                    <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-[850] text-on-mat">{title}</h1>
                    {lede ? <p className="max-w-2xl text-on-mat-soft">{lede}</p> : null}
                </div>
                {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
            </div>
            {children}
        </MatBand>
    );
}

export function EmptyState({
    title,
    body,
    action,
}: {
    title: string;
    body?: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="rounded-[3px] border border-dashed border-graphite/30 px-6 py-10">
            <h3 className="text-2xl font-bold">{title}</h3>
            {body ? <p className="mt-2 max-w-xl text-graphite-soft">{body}</p> : null}
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}
