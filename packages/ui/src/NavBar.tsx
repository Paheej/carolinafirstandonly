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

export function NavBar({
    siteName,
    homeHref = '/',
    links,
    rightSlot,
    mobileMenu,
    className,
}: NavBarProps) {
    return (
        <header
            className={cn(
                'sticky top-0 z-30 border-b border-brass-dark/40 bg-parchment/90 backdrop-blur',
                className,
            )}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:gap-8 md:px-6">
                <a
                    href={homeHref}
                    className="group flex shrink-0 flex-col leading-none"
                >
                    <span className="font-display text-lg text-ink transition-colors group-hover:text-forest-dark">
                        {siteName}
                    </span>
                    <span className="mt-1 block h-px w-12 bg-brass transition-all group-hover:w-16 group-hover:bg-brass-dark" />
                </a>

                <nav className="hidden md:flex items-center gap-1">
                    {links.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-sm px-3 py-2',
                                'text-sm font-medium text-ink-soft',
                                'transition-colors hover:bg-parchment-dark hover:text-forest-dark',
                            )}
                        >
                            {l.label}
                            {l.badge && l.badge > 0 ? (
                                <span className="rounded-full bg-brass/30 px-1.5 py-0.5 text-[10px] text-ink">
                                    {l.badge}
                                </span>
                            ) : null}
                        </a>
                    ))}
                </nav>

                <div className="ml-auto hidden md:flex items-center gap-3">
                    {rightSlot}
                </div>

                <div className="ml-auto md:hidden">{mobileMenu}</div>
            </div>
        </header>
    );
}
