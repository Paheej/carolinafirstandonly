import Link from 'next/link';
import type { Season } from '@cfo/database/types';
import { MatBand, WarTable, SystemPill, buttonClasses } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import {
    getActiveCampaigns,
    getCampaignTimeline,
    getEventTimeline,
    getLatestRecaps,
    getSystemIconMap,
    type TimelineEntry,
} from '@/lib/archive';
import { excerpt, externalLabel, firstImageUrl, sizedImage } from '@/lib/markdown';
import { getNextGameDay } from '@/lib/events';
import { fmtDay, fmtTimeRange } from '@/lib/time';

function timelineDate(date: string | null, year: number | null) {
    if (date) {
        return new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
    return year ? String(year) : null;
}

function systemLabel(c: Pick<Season, 'game_system' | 'game_edition'>) {
    if (!c.game_system) return null;
    return c.game_edition ? `${c.game_system}, ${c.game_edition}` : c.game_system;
}

export default async function HomePage() {
    const user = await getCurrentUser();
    const [next, active, campaigns, events, recaps, iconMap] = await Promise.all([
        getNextGameDay(user?.id ?? null),
        getActiveCampaigns(),
        getCampaignTimeline(),
        getEventTimeline(),
        getLatestRecaps(4),
        getSystemIconMap(),
    ]);

    // The table features the next game day; running campaigns sit underneath it.
    return (
        <>
            {/* ---- The war table -------------------------------------------- */}
            <MatBand aria-labelledby="table-h" innerClassName="grid items-center gap-10 py-10 md:grid-cols-[5fr_7fr] md:py-14">
                <div className="grid min-w-0 gap-6">
                    {next ? (
                        <div className="grid gap-3">
                            <p className="cfo-kicker">Next game day</p>
                            <h1 id="table-h" className="text-[clamp(2.5rem,6vw,4.5rem)] font-[850] leading-[0.95] text-on-mat">
                                {next.title}
                            </h1>
                            <dl className="cfo-num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
                                <dt className="cfo-ui text-on-mat-soft">When</dt>
                                <dd>
                                    {fmtDay(next.starts_at)}, {fmtTimeRange(next.starts_at, next.ends_at)}
                                </dd>
                                {next.location ? (
                                    <>
                                        <dt className="cfo-ui text-on-mat-soft">Where</dt>
                                        <dd>{next.location}</dd>
                                    </>
                                ) : null}
                                <dt className="cfo-ui text-on-mat-soft">Going</dt>
                                <dd>
                                    {next.going}
                                    {next.capacity ? ` of ${next.capacity}` : ''}
                                    {next.my_status === 'yes' ? ', including you' : ''}
                                </dd>
                            </dl>
                            <div className="flex flex-wrap gap-3 pt-1">
                                <Link href={`/events/${next.slug}`} className={buttonClasses('primary', 'lg')}>
                                    {next.my_status ? 'See who’s coming' : 'RSVP'}
                                </Link>
                                <Link href="/events" className={buttonClasses('outline', 'lg')}>
                                    All game days
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <h1 id="table-h" className="cfo-kicker">
                            {active.length > 0 ? 'On the table now' : 'Carolina First and Only'}
                        </h1>
                    )}
                    {next && active.length > 0 ? (
                        <div className="border-t border-mat-line pt-5">
                            <h2 className="cfo-kicker mb-2">On the table now</h2>
                            <ul className="cfo-ui grid gap-1.5">
                                {active.map((c) => (
                                    <li key={c.id} className="flex flex-wrap items-baseline gap-x-3">
                                        <Link href={`/archive/seasons/${c.slug}`} className="text-[1.15rem] font-semibold text-on-mat no-underline hover:underline hover:decoration-gold-bright">
                                            {c.name}
                                        </Link>
                                        {c.external_url ? (
                                            <a href={c.external_url} className="text-on-mat-soft underline-offset-4 hover:text-on-mat hover:underline">
                                                {externalLabel(c.external_url)}
                                            </a>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : active.length > 0 ? (
                        <ul className="grid gap-7">
                            {active.map((c) => {
                                const blurb = excerpt(c.description_md, 160);
                                const system = systemLabel(c);
                                return (
                                    <li key={c.id} className="grid gap-2.5">
                                        <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-[850] leading-[0.95] text-on-mat">
                                            {c.name}
                                        </h2>
                                        {system ? <p className="cfo-ui text-on-mat-soft">{system}</p> : null}
                                        {blurb ? <p className="max-w-[46ch] text-on-mat-soft">{blurb}</p> : null}
                                        <div className="flex flex-wrap gap-3 pt-1">
                                            {c.external_url ? (
                                                <a href={c.external_url} className={buttonClasses('primary')}>
                                                    {externalLabel(c.external_url)}
                                                </a>
                                            ) : null}
                                            <Link
                                                href={`/archive/seasons/${c.slug}`}
                                                className={buttonClasses(c.external_url ? 'outline' : 'primary')}
                                            >
                                                Campaign page
                                            </Link>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : !next ? (
                        <p className="max-w-[46ch] text-on-mat-soft">
                            Tabletop games in Clemmons and Winston-Salem: 40K campaigns, D&D, and the odd tournament day.
                        </p>
                    ) : null}
                    {next ? null : (
                        <div className="border-t border-mat-line pt-5">
                            {user ? (
                                <Link href="/events/new" className={buttonClasses('outline')}>
                                    Plan a game day
                                </Link>
                            ) : (
                                <Link href="/auth/signup" className={buttonClasses('outline')}>
                                    Join the club
                                </Link>
                            )}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <WarTable />
                    <p className="cfo-ui mt-2.5 text-sm text-on-mat-soft">
                        A Strike Force board, 60 by 44 inches. Objective 1 sits dead center; the dashed ring is 6
                        inches.
                    </p>
                </div>
            </MatBand>

            {/* ---- Reports + campaigns ------------------------------------- */}
            <div className="grid gap-12 py-14 md:grid-cols-[8fr_4fr]">
                <section className="min-w-0" aria-labelledby="reports-h">
                    <div className="mb-7 flex flex-wrap items-baseline justify-between gap-4">
                        <h2 id="reports-h" className="text-[2.5rem] font-extrabold">
                            Battle reports
                        </h2>
                        <Link href="/archive" className="cfo-ui cfo-link font-semibold">
                            The full archive
                        </Link>
                    </div>
                    {recaps.length === 0 ? (
                        <p className="text-graphite-soft">No battle reports yet.</p>
                    ) : (
                        <ul>
                            {recaps.map((r) => {
                                const img = r.photos[0]?.url ?? firstImageUrl(r.body_md);
                                const blurb = excerpt(r.body_md, 160);
                                return (
                                    <li key={r.id} className="border-b border-graphite/15 first:pt-0">
                                        <Link
                                            href={`/archive/recaps/${r.slug}`}
                                            className="group grid gap-5 py-5 no-underline sm:grid-cols-[9rem_minmax(0,1fr)]"
                                        >
                                            {img ? (
                                                <img
                                                    src={sizedImage(img, 400)}
                                                    alt=""
                                                    loading="lazy"
                                                    className="aspect-video w-full rounded-[2px] bg-mat-raised object-cover sm:aspect-[4/3]"
                                                />
                                            ) : (
                                                <div aria-hidden="true" className="hidden aspect-[4/3] rounded-[2px] bg-mat-raised sm:block" />
                                            )}
                                            <div className="min-w-0">
                                                <h3 className="text-[1.75rem] font-bold decoration-gold underline-offset-4 group-hover:underline">
                                                    {r.title}
                                                </h3>
                                                {blurb ? (
                                                    <p className="mt-1.5 max-w-[60ch] text-base text-graphite-soft">{blurb}</p>
                                                ) : null}
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <div className="grid min-w-0 content-start gap-12">
                    <Timeline id="campaigns-h" title="Campaigns" entries={campaigns} iconMap={iconMap} />
                    <Timeline id="events-h" title="Events" entries={events} iconMap={iconMap} />
                </div>
            </div>
        </>
    );
}

function Timeline({
    id,
    title,
    entries,
    iconMap,
}: {
    id: string;
    title: string;
    entries: TimelineEntry[];
    iconMap: Record<string, string>;
}) {
    if (entries.length === 0) return null;
    return (
        <section aria-labelledby={id}>
            <h2 id={id} className="mb-7 text-[2.5rem] font-extrabold">
                {title}
            </h2>
            <ol className="cfo-timeline">
                {entries.map((c) => (
                    <li key={c.slug} data-live={c.active ? '' : undefined}>
                        <div className="cfo-ui cfo-num text-sm font-semibold text-graphite-soft">
                            {c.active ? 'Running now' : (timelineDate(c.date, c.year) ?? 'Undated')}
                        </div>
                        <Link
                            href={c.href}
                            className="block font-display text-[1.35rem] font-bold leading-tight no-underline [font-stretch:78%] hover:underline hover:decoration-gold"
                        >
                            {c.name}
                        </Link>
                        {c.game_system ? (
                            <SystemPill
                                className="mt-1.5"
                                system={c.game_system}
                                edition={c.game_edition}
                                icon={iconMap[c.game_system] ?? null}
                            />
                        ) : null}
                    </li>
                ))}
            </ol>
        </section>
    );
}
