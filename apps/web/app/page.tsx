import Link from 'next/link';
import { MatBand, WarTable, SystemPill, buttonClasses } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import {
    getCampaignTimeline,
    getLatestRecaps,
    getSystemIconMap,
    campaignHref,
} from '@/lib/archive';
import { excerpt, firstImageUrl, sizedImage } from '@/lib/markdown';

function campaignDate(date: string | null, year: number | null, withDay = false) {
    if (date) {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'long',
            ...(withDay ? { day: 'numeric' } : {}),
            year: 'numeric',
            timeZone: 'UTC',
        });
    }
    return year ? String(year) : null;
}

export default async function HomePage() {
    const [user, timeline, recaps, iconMap] = await Promise.all([
        getCurrentUser(),
        getCampaignTimeline(),
        getLatestRecaps(4),
        getSystemIconMap(),
    ]);

    // Until events + RSVPs ship (Phase 3), the table features the newest campaign.
    const current = timeline[0] ?? null;
    const currentBlurb = current ? excerpt(current.description_md, 220) : null;

    return (
        <>
            {/* ---- The war table -------------------------------------------- */}
            <MatBand aria-labelledby="table-h" innerClassName="grid items-center gap-10 py-10 md:grid-cols-[5fr_7fr] md:py-14">
                <div className="grid min-w-0 gap-5">
                    <div className="cfo-kicker">{current ? 'Now running' : 'Carolina First and Only'}</div>
                    <h1 id="table-h" className="text-[clamp(2.75rem,7vw,5rem)] font-[850] text-on-mat">
                        {current?.name ?? 'Carolina First and Only'}
                    </h1>
                    {current ? (
                        <dl className="cfo-num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
                            {campaignDate(current.date, current.year) ? (
                                <>
                                    <dt className="cfo-ui text-on-mat-soft">Started</dt>
                                    <dd>{campaignDate(current.date, current.year)}</dd>
                                </>
                            ) : null}
                            <dt className="cfo-ui text-on-mat-soft">Type</dt>
                            <dd>{current.kind === 'season' ? 'Campaign season' : 'Special event'}</dd>
                            {current.game_system ? (
                                <>
                                    <dt className="cfo-ui text-on-mat-soft">System</dt>
                                    <dd>
                                        {current.game_system}
                                        {current.game_edition ? ` ${current.game_edition}` : ''}
                                    </dd>
                                </>
                            ) : null}
                        </dl>
                    ) : null}
                    {currentBlurb ? <p className="max-w-[46ch] text-on-mat-soft">{currentBlurb}</p> : null}
                    <div className="flex flex-wrap gap-3">
                        {current ? (
                            <Link href={campaignHref(current)} className={buttonClasses('primary', 'lg')}>
                                Read the campaign
                            </Link>
                        ) : null}
                        {user ? (
                            <Link href="/archive/submit" className={buttonClasses('outline', 'lg')}>
                                Submit a battle report
                            </Link>
                        ) : (
                            <Link href="/auth/signup" className={buttonClasses('outline', 'lg')}>
                                Join the club
                            </Link>
                        )}
                    </div>
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

                <section className="min-w-0" aria-labelledby="campaigns-h">
                    <h2 id="campaigns-h" className="mb-7 text-[2.5rem] font-extrabold">
                        Campaigns
                    </h2>
                    <ol className="cfo-timeline">
                        {timeline.map((c, i) => (
                            <li key={`${c.kind}-${c.slug}`} data-live={i === 0 ? '' : undefined}>
                                <div className="cfo-ui cfo-num text-sm font-semibold text-graphite-soft">
                                    {campaignDate(c.date, c.year) ?? 'Undated'}
                                </div>
                                <Link
                                    href={campaignHref(c)}
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
            </div>
        </>
    );
}
