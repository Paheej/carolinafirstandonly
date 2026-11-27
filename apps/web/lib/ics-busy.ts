import ical, { type EventInstance, type VEvent } from 'node-ical';
import { zonedToUtcIso } from './time';

/** Busy windows shared by every calendar provider. Keeps times only. */

export interface Block {
    s: string;
    e: string;
}

const DAY = 86_400_000;

/** The window every provider syncs: yesterday through 90 days out. */
export function syncWindow(now = Date.now()) {
    return { from: new Date(now - DAY), to: new Date(now + 90 * DAY) };
}

/** "2026-12-05" -> midnight Eastern that day, in ms. */
export function easternMidnight(ymd: string): number {
    return Date.parse(zonedToUtcIso(ymd, '00:00')!);
}

/** Sort, merge overlaps, cap. Fewer rows, and less detail kept about anyone's day. */
export function mergeSpans(spans: [number, number][]): Block[] {
    const sorted = spans.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [s, e] of sorted) {
        const last = merged[merged.length - 1];
        if (last && s <= last[1]) last[1] = Math.max(last[1], e);
        else merged.push([s, e]);
    }
    return merged.slice(0, 3000).map(([s, e]) => ({ s: new Date(s).toISOString(), e: new Date(e).toISOString() }));
}

/** Date-only values come back as local midnight; read them as an Eastern calendar day. */
function allDayToUtc(d: Date): number {
    return easternMidnight(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
}

/** An ICS calendar (iCloud link) -> merged busy windows. */
export function busyBlocksFromIcs(text: string, now = Date.now()): Block[] {
    const { from, to } = syncWindow(now);
    const data = ical.sync.parseICS(text);
    const spans: [number, number][] = [];

    for (const c of Object.values(data)) {
        if (!c || c.type !== 'VEVENT') continue;
        let instances: EventInstance[];
        try {
            instances = ical.expandRecurringEvent(c as VEvent, { from, to, expandOngoing: true });
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
            if (e < from.getTime() || s > to.getTime()) continue;
            spans.push([s, e]);
        }
    }
    return mergeSpans(spans);
}
