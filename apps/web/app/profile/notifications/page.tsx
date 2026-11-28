import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, EmptyState, PageHead } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getNotifications } from '@/lib/groups';
import { markAllRead, openNotification } from '@/app/groups/actions';

export const metadata: Metadata = { title: 'Notifications' };

function when(d: string) {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

export default async function NotificationsPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/profile/notifications');
    const items = await getNotifications(user.id);
    const unread = items.filter((n) => !n.read_at).length;

    return (
        <>
            <PageHead
                kicker="Profile"
                title="Notifications"
                actions={
                    unread > 0 ? (
                        <form action={markAllRead}>
                            <Button type="submit" variant="outline" size="sm">Mark all read</Button>
                        </form>
                    ) : null
                }
            />
            <div className="max-w-3xl py-10">
                {items.length === 0 ? (
                    <EmptyState title="Nothing yet" body="Join requests, invites and recap reviews show up here." />
                ) : (
                    <ul className="border-t border-graphite/15">
                        {items.map((n) => (
                            <li key={n.id} className="border-b border-graphite/15">
                                <form action={openNotification}>
                                    <input type="hidden" name="id" value={n.id} />
                                    <input type="hidden" name="link" value={n.link_url ?? ''} />
                                    <button type="submit" className="grid w-full gap-1 py-4 text-left hover:bg-primer-lift/60 sm:grid-cols-[1rem_minmax(0,1fr)_auto] sm:gap-x-3">
                                        <span aria-hidden="true" className={`mt-2 hidden size-2 rounded-full sm:block ${n.read_at ? '' : 'bg-gold'}`} />
                                        <span className="min-w-0">
                                            <span className={`block text-[1.05rem] ${n.read_at ? '' : 'font-semibold'}`}>
                                                {n.read_at ? null : <span className="sr-only">Unread: </span>}
                                                {n.title}
                                            </span>
                                            {n.body ? <span className="block text-base text-graphite-soft">{n.body}</span> : null}
                                        </span>
                                        <span className="cfo-ui cfo-num text-sm text-graphite-soft">{when(n.created_at)}</span>
                                    </button>
                                </form>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}
