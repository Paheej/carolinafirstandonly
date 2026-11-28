import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { firstImageUrl, sizedImage, stripLeadingTitle } from '@/lib/markdown';
import { MarkdownRender, PageHead, buttonClasses } from '@cfo/ui';
import { SystemPills } from '@/app/_components/SystemPills';
import { Pencil } from 'lucide-react';
import { getArchiveEventBySlug, gamesOf, getSystemIconMap } from '@/lib/archive';
import { getCurrentUser } from '@/lib/auth';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const event = await getArchiveEventBySlug(slug);
    if (!event) return { title: 'Event not found' };
    return { title: event.name };
}

export default async function ArchiveEventPage({ params }: PageProps) {
    const { slug } = await params;
    const event = await getArchiveEventBySlug(slug);
    if (!event) notFound();

    const [iconMap, user] = await Promise.all([
        getSystemIconMap(),
        getCurrentUser(),
    ]);
    const isAdmin = user?.profile?.is_admin ?? false;

    const when = event.event_date
        ? new Date(event.event_date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
          })
        : null;

    return (
        <>
            <PageHead
                image={bannerOf(event.hero_image_url ?? firstImageUrl(event.description_md))}
                tone="light"
                kicker={
                    <Link href="/archive" className="no-underline hover:underline">
                        Archive
                    </Link>
                }
                title={event.name}
                actions={
                    isAdmin ? (
                        <Link href={`/archive/events/${event.slug}/edit`} className={buttonClasses('outline', 'sm')}>
                            <Pencil size={14} /> Edit event
                        </Link>
                    ) : null
                }
            >
                <div className="cfo-ui cfo-num mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-on-mat-soft">
                    <SystemPills games={gamesOf(event)} iconMap={iconMap} />
                    {when ? <span>{when}</span> : null}
                    <span>Special event</span>
                </div>
            </PageHead>

            <div className="py-12">
                {event.description_md ? (
                    <MarkdownRender source={stripLeadingTitle(event.description_md, event.name)} />
                ) : (
                    <p className="text-graphite-soft">No write-up for this event yet.</p>
                )}
            </div>
        </>
    );
}

/** Photo for the page head: sized for a full-width band. */
function bannerOf(url: string | null | undefined) {
    return url ? sizedImage(url, 1600) : null;
}
