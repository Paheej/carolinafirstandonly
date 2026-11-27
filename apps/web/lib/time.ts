/**
 * The club plays in North Carolina, so game-day times are entered and shown
 * in Eastern time regardless of where the server or viewer is. The DB stores
 * UTC (timestamptz).
 */
export const CLUB_TZ = 'America/New_York';

function offsetMinutes(utcMs: number, tz: string): number {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
            .formatToParts(new Date(utcMs))
            .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
    return (asUtc - utcMs) / 60000;
}

/** "2026-12-06" + "13:30" in Eastern -> ISO UTC string. Handles DST. */
export function zonedToUtcIso(date: string, time: string, tz = CLUB_TZ): string | null {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const t = /^(\d{2}):(\d{2})$/.exec(time);
    if (!d || !t) return null;
    const wall = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!);
    let utc = wall - offsetMinutes(wall, tz) * 60000;
    utc = wall - offsetMinutes(utc, tz) * 60000; // second pass settles DST edges
    return new Date(utc).toISOString();
}

/** ISO UTC -> { date: "YYYY-MM-DD", time: "HH:MM" } in Eastern, for form defaults. */
export function utcToZonedParts(iso: string, tz = CLUB_TZ): { date: string; time: string } {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
            .formatToParts(new Date(iso))
            .map((x) => [x.type, x.value]),
    );
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function fmtDay(iso: string, opts: { year?: boolean } = {}) {
    return new Date(iso).toLocaleDateString('en-US', {
        timeZone: CLUB_TZ,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(opts.year ? { year: 'numeric' } : {}),
    });
}

export function fmtShortDay(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { timeZone: CLUB_TZ, weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { timeZone: CLUB_TZ, hour: 'numeric', minute: '2-digit' });
}

/** "1:00 to 5:00 PM", or with dates when it spans days. */
export function fmtTimeRange(startIso: string, endIso: string) {
    const sameDay = utcToZonedParts(startIso).date === utcToZonedParts(endIso).date;
    if (!sameDay) return `${fmtShortDay(startIso)} ${fmtTime(startIso)} to ${fmtShortDay(endIso)} ${fmtTime(endIso)}`;
    return `${fmtTime(startIso)} to ${fmtTime(endIso)}`;
}

export function monthKey(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { timeZone: CLUB_TZ, month: 'long', year: 'numeric' });
}
