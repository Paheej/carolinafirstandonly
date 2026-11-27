import * as React from 'react';
import { cn } from '@cfo/shared';

export interface NavLink {
    href: string;
    label: string;
    badge?: number;
}

export interface NavBarProps {
    siteName: string;
    homeHref?: string;
    links: NavLink[];
    /** Desktop right cluster (e.g., admin chip + profile + sign out). */
    rightSlot?: React.ReactNode;
    /** Mobile menu trigger + drawer; shown <md, hidden ≥md. */
    mobileMenu?: React.ReactNode;
    className?: string;
}

export function NavBar({ siteName, homeHref = '/', links, rightSlot, mobileMenu, className }: NavBarProps) {
    return (
        <header
            className={cn(
                'cfo-on-mat sticky top-0 z-30 border-b border-gold/35 bg-mat text-on-mat',
                className,
            )}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:gap-8 md:px-6">
                <a href={homeHref} className="flex shrink-0 items-baseline gap-2 no-underline font-display">
                    <b className="text-[1.6rem] font-black leading-none text-gold-bright [font-stretch:62%]">
                        CF&amp;O
                    </b>
                    <span className="hidden text-[0.95rem] font-medium text-on-mat-soft [font-stretch:75%] sm:inline">
                        {siteName}
                    </span>
                </a>

                <nav className="cfo-ui hidden items-center gap-5 md:flex" aria-label="Main">
                    {links.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            className="inline-flex items-center gap-1.5 border-b-2 border-transparent py-1 text-[0.95rem] font-semibold text-on-mat-soft no-underline transition-colors hover:border-gold hover:text-on-mat"
                        >
                            {l.label}
                            {l.badge && l.badge > 0 ? (
                                <span className="cfo-num rounded-full bg-gold-bright px-1.5 text-[0.7rem] font-bold text-mat">
                                    {l.badge}
                                </span>
                            ) : null}
                        </a>
                    ))}
                </nav>

                <div className="ml-auto hidden items-center gap-3 md:flex">{rightSlot}</div>
                <div className="ml-auto md:hidden">{mobileMenu}</div>
            </div>
        </header>
    );
}
