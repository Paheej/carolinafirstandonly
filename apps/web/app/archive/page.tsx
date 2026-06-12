import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardBody, Badge, Button } from '@cfo/ui';
import { BookMarked, Calendar, ChevronRight, PenSquare, ShieldCheck } from 'lucide-react';
import { getSeasons, getArchiveEvents } from '@/lib/archive';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
    title: 'Archive',
    description: 'Campaign seasons, special events, and battle recaps.',
};

function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return null;
    const fmt = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '…';
    return `${fmt(start)} — ${fmt(end)}`;
}

export default async function ArchiveIndexPage() {
    const [seasons, events, user] = await Promise.all([
        getSeasons(),
        getArchiveEvents(),
        getCurrentUser(),
    ]);

    return (
        <div className="space-y-12">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-leather font-mono">
                        <BookMarked size={14} />
                        Archive
                    </div>
                    <h1 className="cfo-heading-underline mt-2 font-display text-4xl sm:text-5xl text-ink">
                        Campaigns &amp; recaps
                    </h1>
                    <p className="mt-3 max-w-2xl text-ink-soft">
                        Three seasons of crusade play and a handful of special
                        events. Each entry below collects the rules,
                        battle&nbsp;recaps, and photos that came out of it.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {user?.profile?.is_admin ? (
                        <Link href="/archive/pending" className="no-underline">
                            <Button variant="secondary">
                                <ShieldCheck size={16} /> Review pending
                            </Button>
                        </Link>
                    ) : null}
                    {user ? (
                        <Link href="/archive/submit" className="no-underline">
                            <Button>
                                <PenSquare size={16} /> Submit a recap
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/auth/login?next=/archive/submit" className="no-underline">
                            <Button variant="secondary">
                                <PenSquare size={16} /> Sign in to submit
                            </Button>
                        </Link>
                    )}
                </div>
            </header>

            {/* Seasons */}
            <section>
                <div className="mb-5 flex items-baseline justify-between">
                    <h2 className="cfo-heading-underline font-display text-2xl">
                        Seasons
                    </h2>
                    <span className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-ink-soft/70 font-mono">
                        {seasons.length} entries
                    </span>
                </div>

                {seasons.length === 0 ? (
                    <EmptyState
                        title="No seasons yet"
                        body="Once we migrate the existing content, three seasons of crusade play will sit here."
                    />
                ) : (
                    <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        {seasons.map((s) => (
                            <li key={s.id}>
                                <Link href={`/archive/seasons/${s.slug}`} className="block no-underline">
                                    <Card interactive className="h-full">
                                        <CardBody className="flex h-full flex-col gap-3 px-6 py-6">
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge variant="forest">Season</Badge>
                                                {s.year ? (
                                                    <span className="font-mono text-[11px] text-ink-soft">
                                                        {s.year}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h3 className="font-display text-2xl text-ink leading-tight">
                                                {s.name}
                                            </h3>
                                            {formatDateRange(s.starts_on, s.ends_on) ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                                                    <Calendar size={12} />
                                                    {formatDateRange(s.starts_on, s.ends_on)}
                                                </span>
                                            ) : null}
                                            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-forest">
                                                Enter
                                                <ChevronRight size={14} />
                                            </span>
                                        </CardBody>
                                    </Card>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Special events */}
            <section>
                <div className="mb-5 flex items-baseline justify-between">
                    <h2 className="cfo-heading-underline font-display text-2xl">
                        Special events
                    </h2>
                    <span className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-ink-soft/70 font-mono">
                        {events.length} entries
                    </span>
                </div>

                {events.length === 0 ? (
                    <EmptyState
                        title="No special events yet"
                        body="Tournament days, narrative-event one-shots, and other special battles will land here."
                    />
                ) : (
                    <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        {events.map((e) => (
                            <li key={e.id}>
                                <Link href={`/archive/events/${e.slug}`} className="block no-underline">
                                    <Card interactive className="h-full">
                                        <CardBody className="flex h-full flex-col gap-3 px-6 py-6">
                                            <Badge variant="leather">Special event</Badge>
                                            <h3 className="font-display text-2xl text-ink leading-tight">
                                                {e.name}
                                            </h3>
                                            {e.event_date ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                                                    <Calendar size={12} />
                                                    {new Date(e.event_date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            ) : null}
                                            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-forest">
                                                Enter
                                                <ChevronRight size={14} />
                                            </span>
                                        </CardBody>
                                    </Card>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-sm border border-dashed border-brass-dark/50 bg-parchment/40 px-6 py-10 text-center">
            <h3 className="font-display text-xl text-ink">{title}</h3>
            <p className="mt-2 text-sm text-ink-soft">{body}</p>
        </div>
    );
}
