import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Card, CardBody, Badge, MarkdownRender } from '@cfo/ui';
import { ArrowLeft, Calendar } from 'lucide-react';
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

    const backHref = season
        ? `/archive/seasons/${season.slug}`
        : event
        ? `/archive/events/${event.slug}`
        : '/archive';
    const backLabel = season?.name ?? event?.name ?? 'Archive';

    return (
        <article className="mx-auto max-w-3xl space-y-8">
            <nav className="text-sm">
                <Link href={backHref} className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> {backLabel}
                </Link>
            </nav>

            <header className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {season ? <Badge variant="forest">{season.name}</Badge> : null}
                    {event ? <Badge variant="leather">{event.name}</Badge> : null}
                    {recap.published_at ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                            <Calendar size={12} />
                            {new Date(recap.published_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </span>
                    ) : null}
                </div>
                <h1 className="cfo-heading-underline font-display text-4xl sm:text-5xl text-ink">
                    {recap.title}
                </h1>
                {author ? (
                    <p className="text-sm text-ink-soft">By {author}</p>
                ) : null}
            </header>

            <Card>
                <CardBody className="px-7 py-7">
                    <MarkdownRender source={recap.body_md} />
                </CardBody>
            </Card>

            {recap.photos.length > 0 ? (
                <section className="space-y-3">
                    <h2 className="cfo-heading-underline font-display text-2xl">
                        Photos
                    </h2>
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {recap.photos.map((photo, i) => (
                            <li
                                key={photo.file_id ?? `${photo.url}-${i}`}
                                className="overflow-hidden rounded-sm border border-brass-dark/40 bg-parchment"
                            >
                                <a href={photo.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={photo.url}
                                        alt={photo.caption ?? ''}
                                        className="block w-full"
                                        loading="lazy"
                                    />
                                </a>
                                {photo.caption ? (
                                    <p className="px-3 py-2 text-sm text-ink-soft">
                                        {photo.caption}
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </article>
    );
}
