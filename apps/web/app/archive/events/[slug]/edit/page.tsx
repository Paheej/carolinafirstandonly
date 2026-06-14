import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import {
    getArchiveEventBySlug,
    getGameSystems,
    getGameEditions,
    getSeasons,
} from '@/lib/archive';
import { EventForm } from '../../_components/EventForm';
import { updateEvent } from '../../actions';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: 'Edit special event' };

export default async function EditEventPage({ params }: PageProps) {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();

    const [event, systems, editions, seasons] = await Promise.all([
        getArchiveEventBySlug(slug),
        getGameSystems(),
        getGameEditions(),
        getSeasons(),
    ]);
    if (!event) notFound();

    const initial = {
        slug: event.slug,
        name: event.name,
        event_date: event.event_date ?? '',
        game_system: event.game_system ?? '',
        game_edition: event.game_edition ?? '',
        season_id: event.season_id ?? '',
        hero_image_url: event.hero_image_url ?? '',
        description_md: event.description_md ?? '',
    };

    return (
        <article className="space-y-8">
            <nav className="text-sm">
                <Link href={`/archive/events/${event.slug}`} className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> {event.name}
                </Link>
            </nav>
            <header>
                <h1 className="cfo-heading-underline font-display text-3xl sm:text-4xl text-ink">
                    Edit {event.name}
                </h1>
            </header>
            <EventForm
                mode="edit"
                initial={initial}
                systems={systems}
                editions={editions}
                seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
                onSubmit={(v) => updateEvent(event.slug, v)}
            />
        </article>
    );
}
