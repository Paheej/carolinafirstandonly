import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, Input, Label, MarkdownRender, PageHead, Select, buttonClasses } from '@cfo/ui';
import { CalendarPlus, Download, MapPin, Pencil } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getEventBySlug, getEventDetail, getEventInvites, type RsvpRow } from '@/lib/events';
import { getGroupName, memberName } from '@/lib/groups';
import { excerpt } from '@/lib/markdown';
import { fmtDay, fmtTimeRange } from '@/lib/time';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/ics';
import { Notice, first } from '@/app/groups/_components/Notice';
import { cancelEvent, inviteToEvent, restoreEvent, rsvp, uninvite } from '../actions';
import { VISIBILITY_LABEL } from '../_components/EventFields';

interface PageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const event = await getEventBySlug((await params).slug);
    if (!event) return { title: 'Game day not found' };
    return {
        title: event.title,
        description: `${fmtDay(event.starts_at)}, ${fmtTimeRange(event.starts_at, event.ends_at)}${event.location ? `, ${event.location}` : ''}. ${excerpt(event.description_md, 120) ?? ''}`,
    };
}

function Hidden({ values }: { values: Record<string, string> }) {
    return (
        <>
            {Object.entries(values).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
            ))}
        </>
    );
}

function People({ rows }: { rows: RsvpRow[] }) {
    return (
        <ul className="cfo-ui grid gap-1">
            {rows.map((r) => (
                <li key={r.user_id}>
                    {r.profile ? (
                        <Link href={`/profile/${r.profile.username}`} className="font-semibold no-underline cfo-link-hover">
                            {memberName(r.profile)}
                        </Link>
                    ) : (
                        <span className="font-semibold">{memberName(null)}</span>
                    )}
                    {r.note ? <span className="text-graphite-soft"> {r.note}</span> : null}
                </li>
            ))}
        </ul>
    );
}

export default async function EventPage({ params, searchParams }: PageProps) {
    const [{ slug }, sp, user, h] = await Promise.all([params, searchParams, getCurrentUser(), headers()]);
    const event = await getEventBySlug(slug);
    if (!event) notFound();

    const detail = await getEventDetail(event.id, user?.id ?? null);
    const [invites, group] = await Promise.all([
        detail.canManage ? getEventInvites(event.id) : Promise.resolve([]),
        event.group_id ? getGroupName(event.group_id) : Promise.resolve(null),
    ]);
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get('host')}`;
    const url = `${origin}/events/${event.slug}`;
    const over = new Date(event.ends_at).getTime() < Date.now();
    const closed = over || !!event.cancelled_at;
    const hidden = { event_id: event.id, slug: event.slug };

    const yes = detail.rsvps.filter((r) => r.status === 'yes');
    const maybe = detail.rsvps.filter((r) => r.status === 'maybe');
    const waitlist = detail.rsvps
        .filter((r) => r.status === 'waitlist')
        .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0));
    const no = detail.rsvps.filter((r) => r.status === 'no');
    const roleName = new Map(detail.roles.map((r) => [r.id, r.role_name]));
    const mine = detail.mine;
    const calEvent = {
        title: event.title,
        description: event.description_md,
        location: event.location,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        url,
    };

    return (
        <>
            <PageHead
                kicker={
                    group ? (
                        <Link href={`/groups/${group.slug}`} className="no-underline hover:underline">{group.name}</Link>
                    ) : (
                        <Link href="/events" className="no-underline hover:underline">Game days</Link>
                    )
                }
                title={event.title}
                actions={
                    detail.canManage ? (
                        <Link href={`/events/${event.slug}/edit`} className={buttonClasses('outline', 'sm')}>
                            <Pencil size={14} /> Edit game day
                        </Link>
                    ) : null
                }
            >
                <div className="cfo-ui cfo-num mt-5 grid gap-1 text-[1.1rem] text-on-mat">
                    <p className={event.cancelled_at ? 'line-through decoration-casualty' : ''}>
                        {fmtDay(event.starts_at, { year: new Date(event.starts_at).getFullYear() !== new Date().getFullYear() })},{' '}
                        {fmtTimeRange(event.starts_at, event.ends_at)}
                    </p>
                    {event.location ? (
                        <p className="flex items-center gap-1.5 text-on-mat-soft">
                            <MapPin size={15} aria-hidden="true" />
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                                className="text-on-mat-soft underline-offset-4 hover:text-on-mat hover:underline"
                            >
                                {event.location}
                            </a>
                        </p>
                    ) : null}
                    <p className="text-on-mat-soft">
                        {yes.length} going{event.capacity ? ` of ${event.capacity} seats` : ''}
                        {event.visibility !== 'public' ? `. ${VISIBILITY_LABEL[event.visibility]}` : ''}
                    </p>
                </div>
            </PageHead>
            <Notice notice={first(sp.notice)} error={first(sp.error)} />
            {event.cancelled_at ? (
                <p role="status" className="cfo-ui mt-6 rounded-[3px] border border-casualty/50 bg-casualty/10 px-4 py-3 font-semibold text-casualty">
                    This game day is cancelled.
                </p>
            ) : null}

            <div className="grid gap-12 py-12 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
                <div className="grid min-w-0 content-start gap-10">
                    {event.description_md ? <MarkdownRender source={event.description_md} /> : null}

                    <section aria-labelledby="who-h" className="grid gap-6">
                        <h2 id="who-h" className="text-[2rem] font-extrabold">Who&apos;s coming</h2>
                        {!user ? (
                            <p className="text-graphite-soft">
                                <Link href={`/auth/login?next=/events/${event.slug}`} className="cfo-link">Sign in</Link> to see who&apos;s coming and RSVP.
                            </p>
                        ) : detail.roles.length > 0 ? (
                            <div className="grid gap-6 sm:grid-cols-2">
                                {detail.roles.map((role) => {
                                    const inRole = yes.filter((r) => r.role_id === role.id);
                                    return (
                                        <div key={role.id}>
                                            <h3 className="mb-2 text-[1.35rem] font-bold">
                                                {role.role_name}{' '}
                                                <span className="cfo-num text-[1rem] font-semibold text-gold-deep">
                                                    {inRole.length}{role.max_count ? ` of ${role.max_count}` : ''}
                                                </span>
                                            </h3>
                                            {inRole.length ? <People rows={inRole} /> : <p className="cfo-ui text-graphite-soft">Open</p>}
                                        </div>
                                    );
                                })}
                                {yes.some((r) => !r.role_id) ? (
                                    <div>
                                        <h3 className="mb-2 text-[1.35rem] font-bold">No role yet</h3>
                                        <People rows={yes.filter((r) => !r.role_id)} />
                                    </div>
                                ) : null}
                            </div>
                        ) : yes.length ? (
                            <People rows={yes} />
                        ) : (
                            <p className="text-graphite-soft">No one yet. Be the first.</p>
                        )}

                        {user && waitlist.length ? (
                            <div>
                                <h3 className="mb-2 text-[1.35rem] font-bold">Waitlist</h3>
                                <ol className="cfo-ui grid list-decimal gap-1 pl-5">
                                    {waitlist.map((r) => (
                                        <li key={r.user_id}>
                                            <span className="font-semibold">{memberName(r.profile)}</span>
                                            {r.role_id ? <span className="text-graphite-soft"> for {roleName.get(r.role_id)}</span> : null}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ) : null}
                        {user && maybe.length ? (
                            <div>
                                <h3 className="mb-2 text-[1.35rem] font-bold">Maybe</h3>
                                <People rows={maybe} />
                            </div>
                        ) : null}
                        {user && no.length ? (
                            <p className="cfo-ui text-graphite-soft">{no.length} can&apos;t make it.</p>
                        ) : null}
                    </section>
                </div>

                <aside className="grid content-start gap-8">
                    <section aria-labelledby="rsvp-h" className="rounded-[3px] bg-primer-lift p-5">
                        <h2 id="rsvp-h" className="mb-3 text-[1.5rem] font-bold">
                            {mine?.status === 'yes'
                                ? "You're going"
                                : mine?.status === 'waitlist'
                                  ? `You're #${waitlist.findIndex((r) => r.user_id === mine.user_id) + 1} on the waitlist`
                                  : mine?.status === 'maybe'
                                    ? 'You said maybe'
                                    : mine?.status === 'no'
                                      ? "You can't make it"
                                      : 'Are you in?'}
                        </h2>
                        {closed ? (
                            <p className="text-base text-graphite-soft">{event.cancelled_at ? 'RSVPs are closed.' : 'This game day is over.'}</p>
                        ) : !user ? (
                            <Link href={`/auth/login?next=/events/${event.slug}`} className={buttonClasses('primary')}>Sign in to RSVP</Link>
                        ) : (
                            <form action={rsvp} className="grid gap-3">
                                <Hidden values={hidden} />
                                {detail.roles.length > 0 ? (
                                    <div>
                                        <Label htmlFor="role_id">Role</Label>
                                        <Select id="role_id" name="role_id" defaultValue={mine?.role_id ?? detail.roles[detail.roles.length - 1]?.id}>
                                            {detail.roles.map((r) => {
                                                const taken = yes.filter((x) => x.role_id === r.id && x.user_id !== user.id).length;
                                                const full = r.max_count !== null && taken >= r.max_count;
                                                return (
                                                    <option key={r.id} value={r.id}>
                                                        {r.role_name}
                                                        {r.max_count ? ` (${taken} of ${r.max_count}${full ? ', waitlist' : ''})` : ''}
                                                    </option>
                                                );
                                            })}
                                        </Select>
                                    </div>
                                ) : null}
                                <div>
                                    <Label htmlFor="note">Note (optional)</Label>
                                    <Input id="note" name="note" maxLength={200} defaultValue={mine?.note ?? ''} placeholder="Bringing Necrons, 2000 pts" />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="submit" name="status" value="yes" variant={mine?.status === 'yes' ? 'secondary' : 'primary'}>
                                        {mine?.status === 'yes' ? 'Update' : "I'm going"}
                                    </Button>
                                    <Button type="submit" name="status" value="maybe" variant="outline">Maybe</Button>
                                    <Button type="submit" name="status" value="no" variant="ghost">Can&apos;t go</Button>
                                </div>
                            </form>
                        )}
                    </section>

                    {!event.cancelled_at && !over ? (
                        <section aria-labelledby="cal-h">
                            <h2 id="cal-h" className="mb-3 text-[1.5rem] font-bold">Add to your calendar</h2>
                            <ul className="cfo-ui grid gap-2">
                                <li>
                                    <a href={googleCalendarUrl(calEvent)} className="inline-flex items-center gap-2 font-semibold no-underline cfo-link-hover" target="_blank" rel="noopener noreferrer">
                                        <CalendarPlus size={16} aria-hidden="true" /> Google Calendar
                                    </a>
                                </li>
                                <li>
                                    <a href={outlookCalendarUrl(calEvent)} className="inline-flex items-center gap-2 font-semibold no-underline cfo-link-hover" target="_blank" rel="noopener noreferrer">
                                        <CalendarPlus size={16} aria-hidden="true" /> Outlook
                                    </a>
                                </li>
                                <li>
                                    <a href={`/events/${event.slug}/ics`} className="inline-flex items-center gap-2 font-semibold no-underline cfo-link-hover">
                                        <Download size={16} aria-hidden="true" /> Apple Calendar or other (.ics)
                                    </a>
                                </li>
                            </ul>
                            {user ? (
                                <p className="mt-3 text-sm text-graphite-soft">
                                    Tired of adding them one by one?{' '}
                                    <Link href="/profile/settings#calendar" className="cfo-link">Subscribe to all your game days</Link>.
                                </p>
                            ) : null}
                        </section>
                    ) : null}

                    {detail.canManage ? (
                        <section aria-labelledby="org-h" className="grid gap-4 border-t border-graphite/15 pt-6">
                            <h2 id="org-h" className="text-[1.5rem] font-bold">Organizer</h2>
                            <form action={inviteToEvent} className="grid gap-2">
                                <Hidden values={hidden} />
                                <Label htmlFor="username">Invite by username</Label>
                                <div className="flex gap-2">
                                    <Input id="username" name="username" required placeholder="@username" autoComplete="off" />
                                    <Button type="submit" variant="secondary">Invite</Button>
                                </div>
                                {event.visibility === 'hidden' ? (
                                    <p className="text-sm text-graphite-soft">Only invited people can see this game day.</p>
                                ) : null}
                            </form>
                            {invites.length ? (
                                <ul className="cfo-ui grid gap-1.5">
                                    {invites.map((i) => (
                                        <li key={i.user_id} className="flex items-center justify-between gap-2">
                                            <span>{memberName(i.profile)}</span>
                                            <form action={uninvite}>
                                                <Hidden values={{ ...hidden, user_id: i.user_id }} />
                                                <Button type="submit" variant="ghost" size="sm">Remove</Button>
                                            </form>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {over ? null : event.cancelled_at ? (
                                <form action={restoreEvent}>
                                    <Hidden values={hidden} />
                                    <Button type="submit" variant="outline" size="sm">Put it back on</Button>
                                </form>
                            ) : (
                                <form action={cancelEvent}>
                                    <Hidden values={hidden} />
                                    <Button type="submit" variant="danger" size="sm">Cancel game day</Button>
                                    <p className="mt-1 text-sm text-graphite-soft">Everyone who replied gets a notification. You can undo it.</p>
                                </form>
                            )}
                        </section>
                    ) : null}
                </aside>
            </div>
        </>
    );
}
