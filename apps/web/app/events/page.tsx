import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState, PageHead, buttonClasses } from '@cfo/ui';
import { CalendarPlus, Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { listEvents } from '@/lib/events';
import { Notice, first } from '@/app/groups/_components/Notice';
import { EventList } from './_components/EventList';

export const metadata: Metadata = {
    title: 'Game days',
    description: 'Upcoming game days: 40K, D&D and the rest. RSVP and add them to your calendar.',
};

export default async function EventsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
    const past = first(sp.when) === 'past';
    const events = await listEvents(user?.id ?? null, { past, limit: past ? 60 : undefined });

    return (
        <>
            <PageHead
                kicker="Game days"
                title={past ? 'Past game days' : 'Upcoming game days'}
                lede="Pick a seat, say if you're in, and add it to your calendar."
                actions={
                    <>
                        {user ? (
                            <Link href="/profile/settings#calendar" className={buttonClasses('outline')}>
                                <CalendarPlus size={16} /> Sync to your calendar
                            </Link>
                        ) : null}
                        <Link href={user ? '/events/new' : '/auth/login?next=/events/new'} className={buttonClasses('primary')}>
                            <Plus size={16} /> Plan a game day
                        </Link>
                    </>
                }
            />
            <Notice notice={first(sp.notice)} error={first(sp.error)} />
            <div className="py-12">
                {events.length === 0 ? (
                    <EmptyState
                        title={past ? 'No past game days yet' : 'Nothing on the calendar'}
                        body={past ? undefined : 'Plan the next one. You can open it to everyone, keep it to a group, or invite people by name.'}
                        action={
                            past ? undefined : (
                                <Link href={user ? '/events/new' : '/auth/login?next=/events/new'} className={buttonClasses('primary')}>
                                    Plan a game day
                                </Link>
                            )
                        }
                    />
                ) : (
                    <EventList events={events} />
                )}
                <p className="cfo-ui mt-10">
                    <Link href={past ? '/events' : '/events?when=past'} className="cfo-link font-semibold">
                        {past ? 'Upcoming game days' : 'Past game days'}
                    </Link>
                </p>
                {!user ? (
                    <p className="mt-4 text-graphite-soft">
                        Group and invite-only game days show up here once you{' '}
                        <Link href="/auth/login?next=/events" className="cfo-link">sign in</Link>.
                    </p>
                ) : null}
            </div>
        </>
    );
}
