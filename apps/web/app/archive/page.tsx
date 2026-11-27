import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, SystemPill, EmptyState, buttonClasses } from '@cfo/ui';
import { PenSquare, Plus, ShieldCheck } from 'lucide-react';
import { getSeasons, getArchiveEvents, getArchivePages, getSystemIconMap } from '@/lib/archive';
import { getCurrentUser } from '@/lib/auth';
import { excerpt } from '@/lib/markdown';

export const metadata: Metadata = {
    title: 'Archive',
    description: 'Campaign seasons, special events, and battle reports.',
};

function fmtDate(d: string | null, opts: Intl.DateTimeFormatOptions) {
    return d ? new Date(d).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' }) : null;
}

export default async function ArchiveIndexPage() {
    const [seasons, events, pages, iconMap, user] = await Promise.all([
        getSeasons(),
        getArchiveEvents(),
        getArchivePages(),
        getSystemIconMap(),
        getCurrentUser(),
    ]);
    const isAdmin = user?.profile?.is_admin ?? false;

    return (
        <>
            <PageHead
                kicker="Archive"
                title="Campaigns and battle reports"
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
                            <PenSquare size={16} /> {user ? 'Submit a battle report' : 'Sign in to submit'}
                        </Link>
                    </>
                }
            />

            <div className="grid gap-14 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <ArchiveList
                    title="Seasons"
                    newHref={isAdmin ? '/archive/seasons/new' : null}
                    empty="Seasons of campaign play will be listed here."
                    items={seasons.map((s) => ({
                        id: s.id,
                        href: `/archive/seasons/${s.slug}`,
                        name: s.name,
                        when: s.year ? String(s.year) : fmtDate(s.starts_on, { year: 'numeric' }),
                        blurb: excerpt(s.description_md, 140),
                        system: s.game_system,
                        edition: s.game_edition,
                        icon: s.game_system ? iconMap[s.game_system] ?? null : null,
                    }))}
                />
                <ArchiveList
                    title="Special events"
                    newHref={isAdmin ? '/archive/events/new' : null}
                    empty="Tournament days and one-off narrative events will be listed here."
                    items={events.map((e) => ({
                        id: e.id,
                        href: `/archive/events/${e.slug}`,
                        name: e.name,
                        when: fmtDate(e.event_date, { month: 'long', year: 'numeric' }),
                        blurb: excerpt(e.description_md, 140),
                        system: e.game_system,
                        edition: e.game_edition,
                        icon: e.game_system ? iconMap[e.game_system] ?? null : null,
                    }))}
                />
            </div>

            {pages.length > 0 ? (
                <section className="border-t border-graphite/15 py-12" aria-labelledby="ref-h">
                    <h2 id="ref-h" className="mb-2 text-[2rem] font-extrabold">
                        Reference
                    </h2>
                    <p className="mb-6 max-w-2xl text-graphite-soft">
                        Campaign rules, player hubs and faction guides.
                    </p>
                    <ul className="cfo-ui grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                        {pages.map((p) => (
                            <li key={p.id}>
                                <Link href={`/archive/pages/${p.slug}`} className="text-lg font-semibold no-underline cfo-link-hover">
                                    {p.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
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

function ArchiveList({
    title,
    items,
    newHref,
    empty,
}: {
    title: string;
    items: ArchiveItem[];
    newHref: string | null;
    empty: string;
}) {
    return (
        <section className="min-w-0">
            <div className="mb-5 flex items-baseline justify-between gap-3">
                <h2 className="text-[2rem] font-extrabold">{title}</h2>
                {newHref ? (
                    <Link href={newHref} className={buttonClasses('outline', 'sm')}>
                        <Plus size={14} /> New
                    </Link>
                ) : null}
            </div>
            {items.length === 0 ? (
                <EmptyState title={`No ${title.toLowerCase()} yet`} body={empty} />
            ) : (
                <ul className="border-t border-graphite/15">
                    {items.map((it) => (
                        <li key={it.id} className="border-b border-graphite/15">
                            <Link href={it.href} className="group block py-4 no-underline">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                    <h3 className="text-[1.6rem] font-bold decoration-gold underline-offset-4 group-hover:underline">
                                        {it.name}
                                    </h3>
                                    {it.when ? (
                                        <span className="cfo-ui cfo-num text-sm font-semibold text-graphite-soft">{it.when}</span>
                                    ) : null}
                                </div>
                                {it.blurb ? <p className="mt-1 text-base text-graphite-soft">{it.blurb}</p> : null}
                                {it.system ? (
                                    <SystemPill className="mt-2" system={it.system} edition={it.edition} icon={it.icon} />
                                ) : null}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
