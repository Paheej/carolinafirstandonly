import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, SystemPill, EmptyState, buttonClasses } from '@cfo/ui';
import { PenSquare, Plus, ShieldCheck } from 'lucide-react';
import type { ArchiveEvent, Season } from '@cfo/database/types';
import { getSeasons, getArchiveEvents, getSystemIconMap } from '@/lib/archive';
import { getCurrentUser } from '@/lib/auth';
import { excerpt } from '@/lib/markdown';

export const metadata: Metadata = {
    title: 'Archive',
    description: 'Campaign seasons, special events, and recaps.',
};

function fmtDate(d: string | null, opts: Intl.DateTimeFormatOptions) {
    return d ? new Date(d).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' }) : null;
}

export default async function ArchiveIndexPage() {
    const [seasons, events, iconMap, user] = await Promise.all([getSeasons(), getArchiveEvents(), getSystemIconMap(), getCurrentUser()]);
    const isAdmin = user?.profile?.is_admin ?? false;

    // Running campaigns first, then finished ones newest first.
    const running = seasons.filter((s) => s.status === 'active');
    const completed = seasons
        .filter((s) => s.status !== 'active')
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.display_order ?? 0) - (a.display_order ?? 0));
    // Newest event first; undated ones last.
    const eventsDesc = [...events].sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''));
    const seasonItem = (s: Season): ArchiveItem => ({
        id: s.id,
        href: `/archive/seasons/${s.slug}`,
        name: s.name,
        when: s.year ? String(s.year) : fmtDate(s.starts_on, { year: 'numeric' }),
        blurb: excerpt(s.description_md, 140),
        system: s.game_system,
        edition: s.game_edition,
        icon: s.game_system ? iconMap[s.game_system] ?? null : null,
    });
    const eventItem = (e: ArchiveEvent): ArchiveItem => ({
        id: e.id,
        href: `/archive/events/${e.slug}`,
        name: e.name,
        when: fmtDate(e.event_date, { month: 'long', year: 'numeric' }),
        blurb: excerpt(e.description_md, 140),
        system: e.game_system,
        edition: e.game_edition,
        icon: e.game_system ? iconMap[e.game_system] ?? null : null,
    });

    return (
        <>
            <PageHead
                kicker="Archive"
                title="Campaigns and recaps"
                lede="Every season and special event we've run since 2021, with the rules, results, write-ups and photos that came out of it."
                actions={
                    <>
                        {isAdmin ? (
                            <Link href="/archive/pending" className={buttonClasses('outline')}>
                                <ShieldCheck size={16} /> Review submissions
                            </Link>
                        ) : null}
                        <Link
                            href={user ? '/archive/submit' : '/auth/login?next=/archive/submit'}
                            className={buttonClasses('primary')}
                        >
                            <PenSquare size={16} /> {user ? 'Submit a recap' : 'Sign in to submit'}
                        </Link>
                    </>
                }
            />

            <div className="grid gap-14 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="grid min-w-0 content-start gap-10" aria-labelledby="campaigns-h">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 id="campaigns-h" className="text-[2rem] font-extrabold">Campaigns</h2>
                        {isAdmin ? (
                            <Link href="/archive/seasons/new" className={buttonClasses('outline', 'sm')}>
                                <Plus size={14} /> New
                            </Link>
                        ) : null}
                    </div>
                    {seasons.length === 0 ? (
                        <EmptyState title="No campaigns yet" body="Seasons of campaign play will be listed here." />
                    ) : (
                        <>
                            {running.length > 0 ? <ArchiveList title="Running now" items={running.map(seasonItem)} /> : null}
                            {completed.length > 0 ? <ArchiveList title="Completed" items={completed.map(seasonItem)} /> : null}
                        </>
                    )}
                </section>
                <section className="grid min-w-0 content-start gap-10" aria-labelledby="events-h">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 id="events-h" className="text-[2rem] font-extrabold">Special events</h2>
                        {isAdmin ? (
                            <Link href="/archive/events/new" className={buttonClasses('outline', 'sm')}>
                                <Plus size={14} /> New
                            </Link>
                        ) : null}
                    </div>
                    {events.length === 0 ? (
                        <EmptyState title="No special events yet" body="Tournament days and one-off narrative events will be listed here." />
                    ) : (
                        <ArchiveList items={eventsDesc.map(eventItem)} />
                    )}
                </section>
            </div>
        </>
    );
}

interface ArchiveItem {
    id: string;
    href: string;
    name: string;
    when: string | null;
    blurb: string | null;
    system: string | null;
    edition: string | null;
    icon: string | null;
}

function ArchiveList({ title, items }: { title?: string; items: ArchiveItem[] }) {
    return (
        <div className="min-w-0">
            {title ? <h3 className="cfo-ui mb-2 text-lg font-semibold text-graphite-soft">{title}</h3> : null}
            <ul className="border-t border-graphite/15">
                {items.map((it) => (
                    <li key={it.id} className="border-b border-graphite/15">
                        <Link href={it.href} className="group block py-4 no-underline">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <h4 className="font-display text-[1.6rem] font-bold leading-tight decoration-gold underline-offset-4 [font-stretch:72%] group-hover:underline">
                                    {it.name}
                                </h4>
                                {it.when ? <span className="cfo-ui cfo-num text-sm font-semibold text-graphite-soft">{it.when}</span> : null}
                            </div>
                            {it.blurb ? <p className="mt-1 text-base text-graphite-soft">{it.blurb}</p> : null}
                            {it.system ? <SystemPill className="mt-2" system={it.system} edition={it.edition} icon={it.icon} /> : null}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
