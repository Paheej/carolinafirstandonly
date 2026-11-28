'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CLUB_TZ, zonedToUtcIso } from '@/lib/time';

interface Day {
    day_index: number;
    starts_at: string;
    ends_at: string;
    members: number;
    connected: number;
    free: number;
}

const DAYS = 14;
const FIELD_IDS = { group: 'group_id', date: 'date', start: 'start', end: 'end' };

function readWindow(ids: { group: string; date: string; start: string; end: string }) {
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
    const group = v(ids.group);
    const date = v(ids.date);
    const startIso = zonedToUtcIso(date, v(ids.start));
    let endIso = zonedToUtcIso(date, v(ids.end));
    if (!group || !startIso || !endIso) return null;
    if (Date.parse(endIso) <= Date.parse(startIso)) endIso = new Date(Date.parse(endIso) + 86_400_000).toISOString();
    return { group, startIso, endIso };
}

const dayFmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-US', { timeZone: CLUB_TZ, ...o });
const isoDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: CLUB_TZ });

/**
 * "5 of 8 free" for the chosen time, and the same time on the next 13 days.
 * Watches the form's group, date and time fields by id. Counts only: the
 * API never says who is busy.
 */
export function AvailabilityStrip({ ids = FIELD_IDS }: { ids?: typeof FIELD_IDS }) {
    const [win, setWin] = useState<ReturnType<typeof readWindow>>(null);
    const [days, setDays] = useState<Day[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const update = () => setWin(readWindow(ids));
        update();
        const els = Object.values(ids).map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
        els.forEach((el) => {
            el.addEventListener('change', update);
            el.addEventListener('input', update);
        });
        return () =>
            els.forEach((el) => {
                el.removeEventListener('change', update);
                el.removeEventListener('input', update);
            });
    }, [ids]);

    useEffect(() => {
        if (!win) {
            setDays(null);
            return;
        }
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            try {
                const qs = new URLSearchParams({ group_id: win.group, start: win.startIso, end: win.endIso, days: String(DAYS) });
                const res = await fetch(`/api/availability?${qs}`, { signal: ctrl.signal });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error ?? 'Could not load availability.');
                setDays(body.days);
                setError(null);
            } catch (e) {
                if ((e as Error).name !== 'AbortError') {
                    setDays(null);
                    setError((e as Error).message);
                }
            }
        }, 250);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [win]);

    if (!win) return null;

    const pick = (iso: string) => {
        const el = document.getElementById(ids.date) as HTMLInputElement | null;
        if (!el) return;
        el.value = isoDate(iso);
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const today = days?.[0];
    const best = days ? Math.max(...days.map((d) => d.free)) : 0;

    return (
        <section aria-labelledby="avail-h" aria-live="polite" className="grid gap-3 rounded-[3px] bg-primer-lift p-4">
            <h3 id="avail-h" className="cfo-ui text-lg font-semibold">Who&apos;s free</h3>
            {error && <p className="text-sm text-casualty">{error}</p>}
            {!days && !error && <p className="text-sm text-graphite-soft">Checking calendars&hellip;</p>}
            {today && today.connected === 0 && (
                <p className="text-sm">
                    Nobody in this group has connected a calendar yet. Members can do it in{' '}
                    <Link href="/profile/settings#busy" className="text-gold-deep underline underline-offset-4">profile settings</Link>.
                </p>
            )}
            {today && today.connected > 0 && (
                <>
                    <p>
                        <strong className="cfo-num text-2xl">{today.free}</strong> of {today.members} free on{' '}
                        {dayFmt(today.starts_at, { weekday: 'long', month: 'long', day: 'numeric' })}.
                        {today.members > today.connected && (
                            <span className="text-graphite-soft">
                                {' '}
                                {today.members - today.connected} {today.members - today.connected === 1 ? 'hasn’t' : 'haven’t'} connected a calendar.
                            </span>
                        )}
                    </p>
                    <ol className="grid grid-cols-7 gap-1" aria-label="The same time on the next two weeks">
                        {days!.map((d) => {
                            const share = d.connected ? d.free / d.connected : 0;
                            const selected = d.day_index === 0;
                            return (
                                <li key={d.day_index}>
                                    <button
                                        type="button"
                                        onClick={() => pick(d.starts_at)}
                                        aria-pressed={selected}
                                        aria-label={`${dayFmt(d.starts_at, { weekday: 'long', month: 'long', day: 'numeric' })}: ${d.free} of ${d.members} free`}
                                        className={`cfo-ui relative grid w-full place-items-center overflow-hidden rounded-[3px] border px-0.5 py-1.5 text-center leading-tight ${selected ? 'border-graphite' : 'border-graphite/15 hover:border-gold'}`}
                                    >
                                        <span aria-hidden className="absolute inset-x-0 bottom-0 bg-gold-bright/45" style={{ height: `${Math.round(share * 100)}%` }} />
                                        <span className="relative text-xs text-graphite-soft">{dayFmt(d.starts_at, { weekday: 'short' })}</span>
                                        <span className="relative text-sm">{dayFmt(d.starts_at, { day: 'numeric' })}</span>
                                        <span className={`cfo-num relative text-sm ${d.free === best && best > 0 ? 'font-bold' : ''}`}>{d.free}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                    <p className="text-sm text-graphite-soft">The same time over the next two weeks. Tap a day to pick it.</p>
                </>
            )}
        </section>
    );
}
