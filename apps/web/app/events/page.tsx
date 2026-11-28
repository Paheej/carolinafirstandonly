import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState, PageHead, buttonClasses } from '@cfo/ui';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getPlannerGroups, listEvents } from '@/lib/events';
import { getSystemIconMap } from '@/lib/archive';
import { crestFor } from '@/lib/crest';
import { fmtTime, utcToZonedParts, zonedToUtcIso } from '@/lib/time';
import { MonthCalendar, type CalendarDay, type CalendarEvent } from './_components/MonthCalendar';
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
    const calendar = first(sp.view) === 'calendar';
    const past = !calendar && first(sp.when) === 'past';
    const today = utcToZonedParts(new Date().toISOString()).date;
    const month = calendar ? monthGrid(first(sp.month) ?? today.slice(0, 7), today) : null;
    const [events, iconMap, groups] = await Promise.all([
        listEvents(user?.id ?? null, month ? { range: month.range } : { past, limit: past ? 60 : undefined }),
        getSystemIconMap(),
        user && calendar ? getPlannerGroups(user.id) : Promise.resolve([]),
    ]);
    const tab = (on: boolean) =>
        `cfo-ui border-b-2 px-1 pb-1.5 font-semibold no-underline ${on ? 'border-gold text-graphite' : 'border-transparent text-graphite-soft hover:text-graphite'}`;

    return (
        <>
            <PageHead
                kicker="Game days"
                title={calendar ? 'Game day calendar' : past ? 'Past game days' : 'Upcoming game days'}
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
            <div className="py-10">
                <nav aria-label="View" className="mb-8 flex gap-6 border-b border-graphite/15">
                    <Link href="/events" className={tab(!calendar)} aria-current={!calendar ? 'page' : undefined}>List</Link>
                    <Link href="/events?view=calendar" className={tab(calendar)} aria-current={calendar ? 'page' : undefined}>Calendar</Link>
                </nav>
                {month ? (
                    <section aria-labelledby="month-h" className="grid gap-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 id="month-h" className="text-[2rem] font-extrabold">{month.label}</h2>
                            <div className="flex gap-2">
                                <Link href={`/events?view=calendar&month=${month.prev}`} className={buttonClasses('outline', 'sm')} aria-label="Previous month">
                                    <ChevronLeft size={16} />
                                </Link>
                                <Link href="/events?view=calendar" className={buttonClasses('outline', 'sm')}>This month</Link>
                                <Link href={`/events?view=calendar&month=${month.next}`} className={buttonClasses('outline', 'sm')} aria-label="Next month">
                                    <ChevronRight size={16} />
                                </Link>
                            </div>
                        </div>
                        <MonthCalendar
                            days={month.days}
                            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
                            events={events.map(
                                (e): CalendarEvent => ({
                                    slug: e.slug,
                                    title: e.title,
                                    date: utcToZonedParts(e.starts_at).date,
                                    time: fmtTime(e.starts_at),
                                    cancelled: !!e.cancelled_at,
                                    mine: e.my_status === 'yes' || e.my_status === 'maybe',
                                    crest: e.group ? crestFor(e.group.systems, iconMap) : null,
                                }),
                            )}
                        />
                    </section>
                ) : events.length === 0 ? (
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
                    <EventList events={events} iconMap={iconMap} />
                )}
                {!calendar ? (
                    <p className="cfo-ui mt-10">
                        <Link href={past ? '/events' : '/events?when=past'} className="cfo-link font-semibold">
                            {past ? 'Upcoming game days' : 'Past game days'}
                        </Link>
                    </p>
                ) : null}
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

/** Sunday-first weeks covering a month ("2026-12"), in Eastern dates. */
function monthGrid(ym: string, today: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(ym) ?? /^(\d{4})-(\d{2})$/.exec(today.slice(0, 7))!;
    const y = +m[1]!;
    const mo = +m[2]! - 1;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const firstOfMonth = new Date(Date.UTC(y, mo, 1));
    const start = new Date(Date.UTC(y, mo, 1 - firstOfMonth.getUTCDay()));
    const lastOfMonth = new Date(Date.UTC(y, mo + 1, 0));
    const end = new Date(Date.UTC(y, mo + 1, 0 + (6 - lastOfMonth.getUTCDay())));
    const days: CalendarDay[] = [];
    for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
        const date = iso(d);
        days.push({ date, day: d.getUTCDate(), inMonth: d.getUTCMonth() === mo, today: date === today, past: date < today });
    }
    const dayAfter = iso(new Date(end.getTime() + 86_400_000));
    const shift = (n: number) => iso(new Date(Date.UTC(y, mo + n, 1))).slice(0, 7);
    return {
        days,
        label: firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        prev: shift(-1),
        next: shift(1),
        range: { from: zonedToUtcIso(days[0]!.date, '00:00')!, to: zonedToUtcIso(dayAfter, '00:00')! },
    };
}
