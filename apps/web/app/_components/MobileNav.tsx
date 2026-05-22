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
}

export function MobileNav({ links, user }: MobileNavProps) {
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-brass-dark/60 bg-parchment-dark text-ink transition-colors hover:bg-brass/30"
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
                        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
                    />

                    <div className="absolute right-0 top-0 flex h-full w-80 max-w-[88vw] flex-col border-l border-brass-dark/60 bg-parchment shadow-[-12px_0_24px_-12px_rgba(26,24,21,0.4)]">
                        <div className="flex items-center justify-between border-b border-brass-dark/40 px-5 py-4">
                            <span className="font-display text-lg text-ink">Menu</span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close menu"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink-soft hover:bg-parchment-dark"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <nav className="flex-1 overflow-y-auto py-2">
                            {links.map((l) => (
                                <a
                                    key={l.href}
                                    href={l.href}
                                    className="block border-b border-brass-dark/15 px-5 py-3 text-base text-ink hover:bg-parchment-dark"
                                >
                                    {l.label}
                                </a>
                            ))}
                            {user?.profile?.is_admin ? (
                                <a
                                    href="/admin"
                                    className="block border-b border-brass-dark/15 px-5 py-3 text-base font-medium text-leather hover:bg-parchment-dark"
                                >
                                    Admin
                                </a>
                            ) : null}
                        </nav>

                        <div className="space-y-3 border-t border-brass-dark/40 px-4 py-4">
                            {user ? (
                                <>
                                    <a
                                        href="/profile"
                                        className="block rounded-sm border border-brass-dark/50 bg-parchment-dark px-3 py-2.5"
                                    >
                                        <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-soft/70">
                                            Signed in as
                                        </span>
                                        <span className="text-sm font-medium text-ink">
                                            {user.profile?.display_name ??
                                                user.profile?.username ??
                                                user.email}
                                        </span>
                                    </a>
                                    <form action="/api/auth/signout" method="post">
                                        <Button
                                            type="submit"
                                            variant="secondary"
                                            className="w-full"
                                        >
                                            <LogOut size={16} /> Sign out
                                        </Button>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <a href="/auth/login" className="block">
                                        <Button variant="secondary" className="w-full">
                                            Log in
                                        </Button>
                                    </a>
                                    <a href="/auth/signup" className="block">
                                        <Button variant="primary" className="w-full">
                                            Sign up
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
