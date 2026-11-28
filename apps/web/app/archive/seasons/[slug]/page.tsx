import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { firstImageUrl, sizedImage, stripLeadingTitle } from '@/lib/markdown';
import { MarkdownRender, PageHead, SystemPill, buttonClasses } from '@cfo/ui';
import { ExternalLink, PenSquare, Pencil } from 'lucide-react';
import {
    getSeasonBySlug,
    getPublishedRecapsForSeason,
    getArchivePagesForSeason,
    getSystemIconMap,
} from '@/lib/archive';
import { getCurrentUser } from '@/lib/auth';
import { externalLabel } from '@/lib/markdown';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const season = await getSeasonBySlug(slug);
    if (!season) return { title: 'Season not found' };
    return { title: season.name, description: `Recaps from ${season.name}.` };
}

function formatRange(start: string | null, end: string | null) {
    if (!start && !end) return null;
    const fmt = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'ongoing';
    return `${fmt(start)} to ${fmt(end)}`;
}

export default async function SeasonPage({ params }: PageProps) {
    const { slug } = await params;
    const season = await getSeasonBySlug(slug);
    if (!season) notFound();

    const [recaps, pages, iconMap, user] = await Promise.all([
        getPublishedRecapsForSeason(season.id),
        getArchivePagesForSeason(season.id),
        getSystemIconMap(),
        getCurrentUser(),
    ]);

    const isAdmin = user?.profile?.is_admin ?? false;

    const range = formatRange(season.starts_on, season.ends_on);

    return (
        <>
            <PageHead
                image={bannerOf(season.hero_image_url ?? firstImageUrl(season.description_md))}
                tone="light"
                kicker={
                    <Link href="/archive" className="no-underline hover:underline">
                        Archive
                    </Link>
                }
                title={season.name}
                actions={
                    season.external_url || isAdmin ? (
                        <>
                            {season.external_url ? (
                                <a href={season.external_url} className={buttonClasses('primary', 'sm')}>
                                    <ExternalLink size={14} /> {externalLabel(season.external_url)}
                                </a>
                            ) : null}
                            {isAdmin ? (
                                <Link href={`/archive/seasons/${season.slug}/edit`} className={buttonClasses('outline', 'sm')}>
                                    <Pencil size={14} /> Edit campaign
                                </Link>
                            ) : null}
                        </>
                    ) : null
                }
            >
                <div className="cfo-ui cfo-num mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-on-mat-soft">
                    {season.status === 'active' ? <span className="font-semibold text-gold-bright">Running now</span> : null}
                    {season.game_system ? (
                        <SystemPill
                            system={season.game_system}
                            edition={season.game_edition}
                            icon={iconMap[season.game_system] ?? null}
                        />
                    ) : null}
                    {range ?? (season.year ? <span>{season.year}</span> : null)}
                    <span>
                        {recaps.length} {recaps.length === 1 ? 'recap' : 'recaps'}
                    </span>
                </div>
            </PageHead>

            <div className="grid gap-12 py-12 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
                <div className="min-w-0">
                    {season.description_md ? (
                        <MarkdownRender source={stripLeadingTitle(season.description_md, season.name)} />
                    ) : (
                        <p className="text-graphite-soft">No overview written for this campaign yet.</p>
                    )}
                </div>

                <aside className="grid content-start gap-8">
                    <section className="rounded-[3px] bg-primer-lift p-5">
                        <h2 className="mb-3 text-[1.5rem] font-bold">Recaps</h2>
                        {recaps.length === 0 ? (
                            <p className="text-base text-graphite-soft">
                                None yet. Played a game in this campaign?{' '}
                                <Link href="/archive/submit" className="cfo-link">
                                    Write it up
                                </Link>
                                .
                            </p>
                        ) : (
                            <ul className="cfo-ui grid gap-2">
                                {recaps.map((r) => (
                                    <li key={r.id}>
                                        <Link href={`/archive/recaps/${r.slug}`} className="text-[1.05rem] font-semibold no-underline cfo-link-hover">
                                            {r.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {user ? (
                            <Link href="/archive/submit" className={buttonClasses('secondary', 'sm', 'mt-4')}>
                                <PenSquare size={14} /> Submit a recap
                            </Link>
                        ) : null}
                    </section>

                    {pages.length > 0 ? (
                        <section className="rounded-[3px] bg-primer-lift p-5">
                            <h2 className="mb-3 text-[1.5rem] font-bold">Rules and reference</h2>
                            <ul className="cfo-ui grid gap-2">
                                {pages.map((p) => (
                                    <li key={p.id}>
                                        <Link href={`/archive/pages/${p.slug}`} className="text-[1.05rem] font-semibold no-underline cfo-link-hover">
                                            {/* "Season II — House Rules" reads as "House Rules" on Season II's own page. */}
                                            {p.title.replace(/^Season [IVX\d]+\s*[—–-]\s*/, '')}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                </aside>
            </div>
        </>
    );
}

/** Photo for the page head: sized for a full-width band. */
function bannerOf(url: string | null | undefined) {
    return url ? sizedImage(url, 1600) : null;
}
