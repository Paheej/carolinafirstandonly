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
    /**
     * Archive pages: a photo fills the band (dark only behind the title),
     * or, with tone="light" and no photo, a primer band instead of black.
     */
    image?: string | null;
    tone?: 'mat' | 'light';
}

/** Standard page opener: a band with kicker, big condensed title, lede, actions. */
export function PageHead({ kicker, title, lede, actions, children, image, tone = 'mat' }: PageHeadProps) {
    const light = !image && tone === 'light';
    const inner = (
        <>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 space-y-3">
                    {kicker ? <div className={light ? 'cfo-kicker !text-gold-deep' : 'cfo-kicker'}>{kicker}</div> : null}
                    <h1
                        className={`text-[clamp(2.5rem,6vw,4.25rem)] font-[850] ${light ? 'text-graphite' : 'text-on-mat'}`}
                        style={image ? { textShadow: '0 2px 18px rgba(0,0,0,.55)' } : undefined}
                    >
                        {title}
                    </h1>
                    {lede ? <p className={`max-w-2xl ${light ? 'text-graphite-soft' : 'text-on-mat-soft'}`}>{lede}</p> : null}
                </div>
                {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
            </div>
            {children}
        </>
    );
    if (light) {
        return (
            <header className="cfo-band-light">
                <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-12">{inner}</div>
            </header>
        );
    }
    if (image) {
        return (
            <MatBand
                as="header"
                className="cfo-band-photo relative overflow-hidden"
                innerClassName="relative py-16 md:py-24"
                style={{
                    backgroundImage: `linear-gradient(90deg, rgba(13,13,12,.82) 0%, rgba(13,13,12,.5) 45%, rgba(13,13,12,.08) 100%), linear-gradient(0deg, rgba(13,13,12,.55) 0%, rgba(13,13,12,0) 45%), url("${image.replace(/"/g, '%22')}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 35%',
                }}
            >
                {inner}
            </MatBand>
        );
    }
    return (
        <MatBand as="header" innerClassName="py-10 md:py-12">
            {inner}
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
