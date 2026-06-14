import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardBody, MarkdownRender, Button, SystemPill } from '@cfo/ui';
import { ArrowLeft, Calendar, Pencil } from 'lucide-react';
import { getArchiveEventBySlug, getSystemIconMap } from '@/lib/archive';
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

    return (
        <article className="space-y-10">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>

            <header className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <SystemPill
                        system={event.game_system}
                        edition={event.game_edition}
                        icon={event.game_system ? iconMap[event.game_system] : null}
                    />
                    {event.event_date ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                            <Calendar size={12} />
                            {new Date(event.event_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </span>
                    ) : null}
                </div>
                <div className="flex items-start justify-between gap-3">
                    <h1 className="cfo-heading-underline font-display text-4xl sm:text-5xl text-ink">
                        {event.name}
                    </h1>
                    {isAdmin ? (
                        <Link href={`/archive/events/${event.slug}/edit`} className="no-underline shrink-0">
                            <Button size="sm" variant="secondary">
                                <Pencil size={14} /> Edit
                            </Button>
                        </Link>
                    ) : null}
                </div>
            </header>

            {event.description_md ? (
                <Card>
                    <CardBody className="px-7 py-7">
                        <MarkdownRender source={event.description_md} />
                    </CardBody>
                </Card>
            ) : null}
        </article>
    );
}
