import ical, { type EventInstance, type VEvent } from 'node-ical';
import { zonedToUtcIso } from './time';

/** Turns an ICS calendar into merged busy windows. Keeps times only. */

// Window: now - 1 day to now + 90 days.
export interface Block {
    s: string;
    e: string;
}

const DAY = 86_400_000;

/** Date-only values come back as local midnight; read them as an Eastern calendar day. */
function allDayToUtc(d: Date): number {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return Date.parse(zonedToUtcIso(ymd, '00:00')!);
}

export function busyBlocksFromIcs(text: string, now = Date.now()): Block[] {
    const from = new Date(now - DAY);
    const to = new Date(now + 90 * DAY);
    const data = ical.sync.parseICS(text);
    const spans: [number, number][] = [];

    for (const c of Object.values(data)) {
        if (!c || c.type !== 'VEVENT') continue;
        const ev = c as VEvent;
        let instances: EventInstance[];
        try {
            instances = ical.expandRecurringEvent(ev, { from, to, expandOngoing: true });
        } catch {
            continue; // one malformed rule shouldn't sink the whole calendar
        }
        for (const inst of instances) {
            const src = inst.event;
            if (src.status === 'CANCELLED' || src.transparency === 'TRANSPARENT') continue;
            let s: number;
            let e: number;
            if (inst.isFullDay) {
                s = allDayToUtc(inst.start);
                e = inst.end ? allDayToUtc(inst.end) : s + DAY;
                if (e <= s) e = s + DAY;
            } else {
                s = inst.start.getTime();
                e = inst.end ? inst.end.getTime() : s;
            }
            if (!(e > s) || e < from.getTime() || s > to.getTime()) continue;
            spans.push([s, e]);
        }
    }

    // Merge overlaps: fewer rows, and less detail kept about anyone's day.
    spans.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [s, e] of spans) {
        const last = merged[merged.length - 1];
        if (last && s <= last[1]) last[1] = Math.max(last[1], e);
        else merged.push([s, e]);
    }
    return merged.slice(0, 3000).map(([s, e]) => ({ s: new Date(s).toISOString(), e: new Date(e).toISOString() }));
}

