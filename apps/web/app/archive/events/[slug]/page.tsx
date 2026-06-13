import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardBody, Badge, MarkdownRender } from '@cfo/ui';
import { ArrowLeft, Calendar } from 'lucide-react';
import { getArchiveEventBySlug } from '@/lib/archive';

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

    return (
        <article className="space-y-10">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>

            <header className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {event.game_system ? (
                        <Badge variant="brass">
                            {event.game_system}
                            {event.game_edition ? ` · ${event.game_edition}` : null}
                        </Badge>
                    ) : null}
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
                <h1 className="cfo-heading-underline font-display text-4xl sm:text-5xl text-ink">
                    {event.name}
                </h1>
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
