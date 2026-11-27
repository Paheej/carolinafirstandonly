import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, PageHead } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getPlannerGroups } from '@/lib/events';
import { Notice, first } from '@/app/groups/_components/Notice';
import { createEvent } from '../actions';
import { EventFields } from '../_components/EventFields';

export const metadata: Metadata = { title: 'Plan a game day' };

export default async function NewEventPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
    if (!user) redirect('/auth/login?next=/events/new');
    const groups = await getPlannerGroups(user.id);
    const wanted = first(sp.group);
    const defaultGroupId = groups.find((g) => g.id === wanted || g.slug === wanted)?.id;

    return (
        <>
            <PageHead kicker="Game days" title="Plan a game day" lede="Post it, and people can RSVP and add it to their calendars." />
            <Notice error={first(sp.error)} />
            <form action={createEvent} className="max-w-3xl py-10">
                <EventFields groups={groups} defaultGroupId={defaultGroupId} />
                <div className="mt-8">
                    <Button type="submit" size="lg">Post game day</Button>
                </div>
            </form>
        </>
    );
}
