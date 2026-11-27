import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { stripLeadingTitle } from '@/lib/markdown';
import { MarkdownRender, PageHead } from '@cfo/ui';
import { createServerSupabase } from '@cfo/database/server';
import { getRecapBySlug } from '@/lib/archive';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const recap = await getRecapBySlug(slug);
    if (!recap) return { title: 'Recap not found' };
    return { title: recap.title };
}

async function getAuthorUsername(authorId: string | null): Promise<string | null> {
    if (!authorId) return null;
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', authorId)
        .maybeSingle();
    if (!data) return null;
    return data.display_name ?? data.username;
}

export default async function RecapPage({ params }: PageProps) {
    const { slug } = await params;
    const recap = await getRecapBySlug(slug);
    if (!recap || !recap.published_at) notFound();

    const [author, season, event] = await Promise.all([
        getAuthorUsername(recap.author_id),
        recap.season_id
            ? (async () => {
                  const supabase = createServerSupabase(await cookies());
                  const { data } = await supabase
                      .from('seasons')
                      .select('slug, name')
                      .eq('id', recap.season_id!)
                      .maybeSingle();
                  return data;
              })()
            : Promise.resolve(null),
        recap.archive_event_id
            ? (async () => {
                  const supabase = createServerSupabase(await cookies());
                  const { data } = await supabase
                      .from('archive_events')
                      .select('slug, name')
                      .eq('id', recap.archive_event_id!)
                      .maybeSingle();
                  return data;
              })()
            : Promise.resolve(null),
    ]);

    const parent = season
        ? { href: `/archive/seasons/${season.slug}`, name: season.name }
        : event
        ? { href: `/archive/events/${event.slug}`, name: event.name }
        : null;
    const published = new Date(recap.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <>
            <PageHead
                kicker={
                    <span className="flex flex-wrap gap-x-2">
                        <Link href="/archive" className="no-underline hover:underline">
                            Archive
                        </Link>
                        {parent ? (
                            <>
                                <span aria-hidden="true">/</span>
                                <Link href={parent.href} className="no-underline hover:underline">
                                    {parent.name}
                                </Link>
                            </>
                        ) : null}
                    </span>
                }
                title={recap.title}
            >
                {author ? (
                    <p className="cfo-ui mt-4 text-on-mat-soft">
                        Written by {author}. Published {published}.
                    </p>
                ) : null}
            </PageHead>

            <article className="py-12">
                <MarkdownRender source={stripLeadingTitle(recap.body_md, recap.title)} />

                {recap.photos.length > 0 ? (
                    <section className="mt-12 border-t border-graphite/15 pt-10" aria-labelledby="photos-h">
                        <h2 id="photos-h" className="mb-5 text-[2rem] font-extrabold">
                            Photos
                        </h2>
                        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {recap.photos.map((photo, i) => (
                                <li key={photo.file_id ?? `${photo.url}-${i}`}>
                                    <a href={photo.url} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={photo.url}
                                            alt={photo.caption ?? ''}
                                            className="block w-full rounded-[2px]"
                                            loading="lazy"
                                        />
                                    </a>
                                    {photo.caption ? (
                                        <p className="cfo-ui mt-2 text-sm text-graphite-soft">{photo.caption}</p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}
            </article>
        </>
    );
}
