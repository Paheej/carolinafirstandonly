/**
 * Minimal RFC 5545 writer for game days: single-event downloads and the
 * personal subscription feed. Times are written in UTC (…Z) so every
 * calendar app agrees without shipping a VTIMEZONE block.
 */
export interface IcsEvent {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    url?: string;
    starts_at: string;
    ends_at: string;
    updated_at: string;
    sequence: number;
    cancelled?: boolean;
    /** Shown as TENTATIVE for maybe/waitlist. */
    tentative?: boolean;
}

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function esc(s: string) {
    return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines at 75 octets, continuation lines start with a space. */
function fold(line: string): string {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;
    const out: string[] = [];
    let cur = '';
    let len = 0;
    for (const ch of line) {
        const n = new TextEncoder().encode(ch).length;
        if (len + n > (out.length ? 74 : 75)) {
            out.push(cur);
            cur = '';
            len = 0;
        }
        cur += ch;
        len += n;
    }
    out.push(cur);
    return out.join('\r\n ');
}

export function buildCalendar(events: IcsEvent[], opts: { name?: string } = {}): string {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Carolina First and Only//Game days//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...(opts.name ? [`X-WR-CALNAME:${esc(opts.name)}`, 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'] : []),
    ];
    const now = stamp(new Date().toISOString());
    for (const e of events) {
        lines.push(
            'BEGIN:VEVENT',
            `UID:${e.id}@carolinafirstandonly.com`,
            `DTSTAMP:${now}`,
            `LAST-MODIFIED:${stamp(e.updated_at)}`,
            `SEQUENCE:${e.sequence}`,
            `DTSTART:${stamp(e.starts_at)}`,
            `DTEND:${stamp(e.ends_at)}`,
            `SUMMARY:${esc(e.title)}`,
            `STATUS:${e.cancelled ? 'CANCELLED' : e.tentative ? 'TENTATIVE' : 'CONFIRMED'}`,
        );
        const desc = [e.description?.trim(), e.url].filter(Boolean).join('\n\n');
        if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
        if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
        if (e.url) lines.push(`URL:${e.url}`);
        lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
}

/** "Add to Google Calendar" template link. */
export function googleCalendarUrl(e: Pick<IcsEvent, 'title' | 'description' | 'location' | 'starts_at' | 'ends_at' | 'url'>) {
    const p = new URLSearchParams({
        action: 'TEMPLATE',
        text: e.title,
        dates: `${stamp(e.starts_at)}/${stamp(e.ends_at)}`,
        details: [e.description?.slice(0, 800), e.url].filter(Boolean).join('\n\n'),
        ...(e.location ? { location: e.location } : {}),
    });
    return `https://calendar.google.com/calendar/render?${p}`;
}

/** "Add to Outlook" deep link (works for outlook.com and Microsoft 365 web). */
export function outlookCalendarUrl(e: Pick<IcsEvent, 'title' | 'description' | 'location' | 'starts_at' | 'ends_at' | 'url'>) {
    const p = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: e.title,
        startdt: new Date(e.starts_at).toISOString(),
        enddt: new Date(e.ends_at).toISOString(),
        body: [e.description?.slice(0, 800), e.url].filter(Boolean).join('\n\n'),
        ...(e.location ? { location: e.location } : {}),
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}
