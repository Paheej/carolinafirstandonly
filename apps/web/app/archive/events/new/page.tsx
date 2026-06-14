import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getGameSystems, getGameEditions, getSeasons } from '@/lib/archive';
import { EventForm } from '../_components/EventForm';
import { createEvent } from '../actions';

export const metadata: Metadata = { title: 'New special event' };

export default async function NewEventPage() {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();

    const [systems, editions, seasons] = await Promise.all([
        getGameSystems(),
        getGameEditions(),
        getSeasons(),
    ]);

    return (
        <article className="space-y-8">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>
            <header>
                <h1 className="cfo-heading-underline font-display text-3xl sm:text-4xl text-ink">
                    New special event
                </h1>
                <p className="mt-2 text-sm text-ink-soft">
                    One-day tournaments, narrative events, and similar one-shots. Description doubles as the event invite and the recap once it's wrapped.
                </p>
            </header>
            <EventForm
                mode="create"
                systems={systems}
                editions={editions}
                seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
                onSubmit={createEvent}
            />
        </article>
    );
}
