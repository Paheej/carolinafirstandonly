'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GroupCrest } from '@cfo/ui';
import { zonedToUtcIso } from '@/lib/time';

export interface CalendarEvent {
    slug: string;
    title: string;
    date: string; // YYYY-MM-DD, Eastern
    time: string; // "1:00 PM"
    cancelled: boolean;
    mine: boolean;
    crest: { icon: string | null; accent: 'gold' | 'red' } | null;
}

export interface CalendarDay {
    date: string; // YYYY-MM-DD
    day: number;
    inMonth: boolean;
    today: boolean;
    past: boolean;
}

const SLOTS = {
    afternoon: { label: 'Afternoon, 1 to 5 PM', start: '13:00', end: '17:00' },
    evening: { label: 'Evening, 6 to 10 PM', start: '18:00', end: '22:00' },
    day: { label: 'All day, 10 AM to 10 PM', start: '10:00', end: '22:00' },
} as const;
type Slot = keyof typeof SLOTS;

interface Avail {
    free: number;
    members: number;
    connected: number;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Month grid of game days. With a group picked, a gold bar under each
 * upcoming day shows how many of its members are free in the chosen slot
 * (counts only, from /api/availability).
 */
export function MonthCalendar({
    days,
    events,
    groups,
}: {
    days: CalendarDay[];
    events: CalendarEvent[];
    groups: { id: string; name: string }[];
}) {
    const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
    const [slot, setSlot] = useState<Slot>('afternoon');
    const [avail, setAvail] = useState<Record<string, Avail>>({});
    const [error, setError] = useState<string | null>(null);

    const byDate = useMemo(() => {
        const m: Record<string, CalendarEvent[]> = {};
        for (const e of events) (m[e.date] ??= []).push(e);
        return m;
    }, [events]);

    // Upcoming days in view, fetched 21 at a time (the API's limit).
    const upcoming = useMemo(() => days.filter((d) => !d.past), [days]);

    useEffect(() => {
        if (!groupId || upcoming.length === 0) {
            setAvail({});
            return;
        }
        const ctrl = new AbortController();
        const s = SLOTS[slot];
        (async () => {
            try {
                const out: Record<string, Avail> = {};
                for (let i = 0; i < upcoming.length; i += 21) {
                    const first = upcoming[i]!;
                    const n = Math.min(21, upcoming.length - i);
                    const qs = new URLSearchParams({
                        group_id: groupId,
                        start: zonedToUtcIso(first.date, s.start)!,
                        end: zonedToUtcIso(first.date, s.end)!,
                        days: String(n),
                    });
                    const res = await fetch(`/api/availability?${qs}`, { signal: ctrl.signal });
                    const body = await res.json();
                    if (!res.ok) throw new Error(body.error ?? 'Could not load availability.');
                    for (const d of body.days as (Avail & { day_index: number })[]) {
                        out[upcoming[i + d.day_index]!.date] = d;
                    }
                }
                setAvail(out);
                setError(null);
            } catch (e) {
                if ((e as Error).name !== 'AbortError') setError((e as Error).message);
            }
        })();
        return () => ctrl.abort();
    }, [groupId, slot, upcoming]);

    const anyConnected = Object.values(avail).some((a) => a.connected > 0);

    return (
        <div className="grid gap-4">
            {groups.length > 0 ? (
                <div className="cfo-ui flex flex-wrap items-end gap-x-5 gap-y-3">
                    <label className="grid gap-1 text-sm font-semibold">
                        Who&apos;s free in
                        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="h-10 rounded-[3px] border border-graphite/15 bg-primer-lift px-3 font-normal">
                            <option value="">Don&apos;t show</option>
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </label>
                    {groupId ? (
                        <label className="grid gap-1 text-sm font-semibold">
                            When
                            <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)} className="h-10 rounded-[3px] border border-graphite/15 bg-primer-lift px-3 font-normal">
                                {(Object.keys(SLOTS) as Slot[]).map((k) => (
                                    <option key={k} value={k}>{SLOTS[k].label}</option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    {groupId && Object.keys(avail).length > 0 && !anyConnected ? (
                        <p className="text-sm text-graphite-soft">
                            Nobody in this group has connected a calendar yet.{' '}
                            <Link href="/profile/settings#busy" className="cfo-link">Connect yours</Link>
                        </p>
                    ) : null}
                    {error ? <p className="text-sm text-casualty">{error}</p> : null}
                </div>
            ) : null}

            <div className="grid grid-cols-7 border-l border-t border-graphite/15" role="grid" aria-label="Game days this month">
                {DOW.map((d) => (
                    <div key={d} role="columnheader" className="cfo-ui border-b border-r border-graphite/15 px-1.5 py-1 text-xs font-semibold text-graphite-soft sm:px-2 sm:text-sm">
                        {d}
                    </div>
                ))}
                {days.map((d) => {
                    const evs = byDate[d.date] ?? [];
                    const a = avail[d.date];
                    const share = a && a.members ? a.free / a.members : 0;
                    return (
                        <div
                            key={d.date}
                            role="gridcell"
                            className={`flex min-h-[4.75rem] min-w-0 flex-col gap-1 border-b border-r border-graphite/15 p-1 sm:min-h-[6.5rem] sm:p-1.5 ${
                                d.inMonth ? 'bg-primer-lift' : 'text-graphite-soft/70'
                            }`}
                        >
                            <span
                                className={`cfo-ui cfo-num self-start text-sm font-bold ${d.today ? 'rounded-[2px] bg-graphite px-1 text-primer-lift' : ''}`}
                            >
                                {d.day}
                            </span>
                            {evs.map((e) => (
                                <Link
                                    key={e.slug}
                                    href={`/events/${e.slug}`}
                                    title={`${e.title}, ${e.time}`}
                                    className={`cfo-ui flex min-w-0 items-center gap-1 rounded-[2px] border-l-[3px] bg-mat px-1 py-0.5 text-[0.7rem] font-semibold leading-tight text-on-mat no-underline hover:bg-mat-raised sm:px-1.5 sm:text-[0.8rem] ${
                                        e.crest?.accent === 'red' ? 'border-casualty' : 'border-gold-bright'
                                    } ${e.cancelled ? 'line-through opacity-60' : ''}`}
                                >
                                    {e.crest ? <GroupCrest size={15} icon={e.crest.icon} accent={e.crest.accent} className="hidden sm:inline-grid" /> : null}
                                    <span className="min-w-0 truncate">
                                        {e.mine ? <span className="text-gold-bright">● </span> : null}
                                        {e.title}
                                    </span>
                                </Link>
                            ))}
                            {a && a.connected > 0 ? (
                                <div className="mt-auto grid gap-0.5" title={`${a.free} of ${a.members} free`}>
                                    <span className="cfo-num text-[0.7rem] leading-none text-graphite-soft">
                                        {a.free}/{a.members}
                                        <span className="sr-only"> members free</span>
                                    </span>
                                    <span className="block h-[5px] overflow-hidden rounded-[3px] bg-graphite/15">
                                        <span className="block h-full bg-gold" style={{ width: `${Math.round(share * 100)}%` }} />
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            <p className="cfo-ui text-sm text-graphite-soft">
                <span className="text-gold-deep">●</span> marks game days you&apos;re going to or might go to.
                {groups.length > 0 ? ' The gold bar is how many group members are free, from connected calendars.' : ''}
            </p>
        </div>
    );
}
