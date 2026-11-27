import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, PageHead } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getEventBySlug, getEventDetail, getPlannerGroups } from '@/lib/events';
import { Notice, first } from '@/app/groups/_components/Notice';
import { updateEvent } from '../../actions';
import { EventFields } from '../../_components/EventFields';

export const metadata: Metadata = { title: 'Edit game day' };

export default async function EditEventPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ slug }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
    if (!user) redirect(`/auth/login?next=/events/${slug}/edit`);
    const event = await getEventBySlug(slug);
    if (!event) notFound();
    const [detail, groups] = await Promise.all([getEventDetail(event.id, user.id), getPlannerGroups(user.id)]);
    if (!detail.canManage) notFound();
    // Keep the current group selectable even if the editor (a site admin) isn't in it.
    if (event.group_id && !groups.some((g) => g.id === event.group_id)) {
        groups.unshift({ id: event.group_id, slug: '', name: 'Current group', templates: [] });
    }

    return (
        <>
            <PageHead
                kicker={<Link href={`/events/${event.slug}`} className="no-underline hover:underline">{event.title}</Link>}
                title="Edit game day"
                lede="Changing the time or place tells everyone who replied, and updates their calendars."
            />
            <Notice error={first(sp.error)} />
            <form action={updateEvent} className="max-w-3xl py-10">
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="slug" value={event.slug} />
                <EventFields event={event} roles={detail.roles} groups={groups} />
                <p className="mt-6 text-sm text-graphite-soft">Removing a role keeps the people in it, without a role.</p>
                <div className="mt-6">
                    <Button type="submit" size="lg">Save changes</Button>
                </div>
            </form>
        </>
    );
}
