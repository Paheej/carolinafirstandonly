'use client';

import { useEffect, useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { Button } from '@cfo/ui';
import type { CurrentUser } from '@/lib/auth';

interface MobileNavLink {
    href: string;
    label: string;
}

interface MobileNavProps {
    links: MobileNavLink[];
    user: CurrentUser | null;
    unread?: number;
}

export function MobileNav({ links, user, unread = 0 }: MobileNavProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const root = document.documentElement;
        const prev = root.style.overflow;
        root.style.overflow = 'hidden';
        return () => {
            root.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-expanded={open}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] border border-gold/50 text-on-mat transition-colors hover:border-gold-bright"
            >
                <Menu size={18} />
            </button>

            {open ? (
                <div
                    className="fixed inset-0 z-50 md:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Main navigation"
                >
                    <button
                        type="button"
                        aria-label="Close menu"
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 bg-mat/55 backdrop-blur-sm"
                    />

                    <div className="absolute right-0 top-0 flex h-full w-80 max-w-[88vw] cfo-on-mat flex-col border-l border-gold/35 bg-mat text-on-mat">
                        <div className="flex items-center justify-between border-b border-on-mat/10 px-5 py-4">
                            <span className="font-display text-2xl font-extrabold text-on-mat">Menu</span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close menu"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] text-on-mat-soft hover:bg-mat-raised"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <nav className="flex-1 overflow-y-auto py-2">
                            {links.map((l) => (
                                <a
                                    key={l.href}
                                    href={l.href}
                                    className="block border-b border-on-mat/10 px-5 py-3 cfo-ui text-lg font-semibold text-on-mat no-underline hover:bg-mat-raised"
                                >
                                    {l.label}
                                </a>
                            ))}
                            {user ? (
                                <a
                                    href="/profile/notifications"
                                    className="flex items-center justify-between border-b border-on-mat/10 px-5 py-3 cfo-ui text-lg font-semibold text-on-mat no-underline hover:bg-mat-raised"
                                >
                                    Notifications
                                    {unread > 0 ? (
                                        <span className="cfo-num rounded-full bg-gold-bright px-2 text-sm font-bold text-graphite">{unread}</span>
                                    ) : null}
                                </a>
                            ) : null}
                            {user?.profile?.is_admin ? (
                                <a
                                    href="/admin"
                                    className="block border-b border-on-mat/10 px-5 py-3 cfo-ui text-lg font-semibold text-gold-bright no-underline hover:bg-mat-raised"
                                >
                                    Admin
                                </a>
                            ) : null}
                        </nav>

                        <div className="space-y-3 border-t border-on-mat/10 px-4 py-4">
                            {user ? (
                                <>
                                    <a
                                        href="/profile"
                                        className="block rounded-[3px] bg-mat-raised px-3 py-2.5 no-underline"
                                    >
                                        <span className="block cfo-ui text-sm text-on-mat-soft">
                                            Signed in as
                                        </span>
                                        <span className="cfo-ui font-semibold text-on-mat">
                                            {user.profile?.display_name ??
                                                user.profile?.username ??
                                                user.email}
                                        </span>
                                    </a>
                                    <form action="/api/auth/signout" method="post">
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <LogOut size={16} /> Sign out
                                        </Button>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <a href="/auth/login" className="block">
                                        <Button variant="outline" className="w-full">
                                            Sign in
                                        </Button>
                                    </a>
                                    <a href="/auth/signup" className="block">
                                        <Button variant="primary" className="w-full">
                                            Join
                                        </Button>
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
