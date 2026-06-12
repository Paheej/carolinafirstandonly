import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardBody, Badge, MarkdownRender, Button } from '@cfo/ui';
import { ArrowLeft, Calendar, ChevronRight, PenSquare } from 'lucide-react';
import { getArchiveEventBySlug, getPublishedRecapsForEvent } from '@/lib/archive';
import { getCurrentUser } from '@/lib/auth';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const event = await getArchiveEventBySlug(slug);
    if (!event) return { title: 'Event not found' };
    return { title: event.name, description: `Recaps from ${event.name}.` };
}

export default async function ArchiveEventPage({ params }: PageProps) {
    const { slug } = await params;
    const event = await getArchiveEventBySlug(slug);
    if (!event) notFound();

    const [recaps, user] = await Promise.all([
        getPublishedRecapsForEvent(event.id),
        getCurrentUser(),
    ]);

    return (
        <article className="space-y-10">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>

            <header className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="leather">Special event</Badge>
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

            <section className="space-y-5">
                <div className="flex items-baseline justify-between">
                    <h2 className="cfo-heading-underline font-display text-2xl">
                        Recaps
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-ink-soft/70 font-mono">
                            {recaps.length} published
                        </span>
                        {user ? (
                            <Link href="/archive/submit" className="no-underline">
                                <Button size="sm" variant="secondary">
                                    <PenSquare size={14} /> Add yours
                                </Button>
                            </Link>
                        ) : null}
                    </div>
                </div>

                {recaps.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-brass-dark/50 bg-parchment/40 px-6 py-10 text-center">
                        <h3 className="font-display text-xl text-ink">
                            No recaps yet
                        </h3>
                        <p className="mt-2 text-sm text-ink-soft">
                            Were you at this one?{' '}
                            <Link href="/archive/submit" className="underline">
                                Write it up
                            </Link>
                            .
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {recaps.map((r) => (
                            <li key={r.id}>
                                <Link
                                    href={`/archive/recaps/${r.slug}`}
                                    className="block no-underline"
                                >
                                    <Card interactive>
                                        <CardBody className="flex items-center justify-between gap-4 px-6 py-4">
                                            <div>
                                                <h3 className="font-display text-xl text-ink">
                                                    {r.title}
                                                </h3>
                                                {r.published_at ? (
                                                    <span className="text-xs text-ink-soft">
                                                        {new Date(r.published_at).toLocaleDateString(
                                                            'en-US',
                                                            { month: 'short', day: 'numeric', year: 'numeric' },
                                                        )}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <ChevronRight size={18} className="text-ink-soft" />
                                        </CardBody>
                                    </Card>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </article>
    );
}
