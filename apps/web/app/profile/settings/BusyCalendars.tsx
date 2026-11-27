import { Button, Input, Label, buttonClasses } from '@cfo/ui';
import type { MyCalendar } from '@/lib/calendars';
import { providerName } from '@/lib/calendar-sync';
import { fmtShortDay, fmtTime } from '@/lib/time';
import { connectCalendar, disconnectCalendar, syncCalendarNow, toggleCalendar } from '../actions';

const ICLOUD_STEPS = [
    'On your iPhone, open Calendar and tap Calendars at the bottom.',
    'Tap the ⓘ next to the calendar you use.',
    'Turn on Public Calendar, tap Share Link, then Copy, and paste it here.',
];

function syncedLine(c: MyCalendar) {
    if (!c.enabled) return 'Paused. Planners don’t see it.';
    if (!c.last_synced_at) return 'Not synced yet.';
    const n = c.block_count;
    return `Synced ${fmtShortDay(c.last_synced_at)} at ${fmtTime(c.last_synced_at)}, with ${n} busy ${n === 1 ? 'stretch' : 'stretches'} in the next 90 days.`;
}

/** Profile settings: connect calendars so planners see "5 of 8 free". */
export function BusyCalendars({ calendars, providers }: { calendars: MyCalendar[]; providers: { google: boolean; outlook: boolean } }) {
    return (
        <section id="busy" aria-labelledby="busy-h" className="grid max-w-2xl gap-4 border-t border-graphite/15 py-10">
            <h2 id="busy-h" className="text-[2rem] font-extrabold">Your busy times, for planning</h2>
            <p>
                Connect your calendar and people planning a game day in your groups see how many members are free, for
                example &ldquo;5 of 8 free&rdquo;. They never see your name next to it, and nobody sees what you&apos;re doing.
            </p>
            <p className="text-sm text-graphite-soft">
                We only ever see when you&apos;re busy, for the next 90 days. Google and Outlook share busy times
                with us without event titles, places or guests, and for iCloud we throw those away as the calendar is read.
                The connection is stored encrypted, and disconnecting deletes it and your busy times. We check once a day.
            </p>

            {calendars.length > 0 && (
                <ul className="divide-y divide-graphite/15 border-y border-graphite/15">
                    {calendars.map((c) => (
                        <li key={c.id} className="grid gap-2 py-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                <span className="cfo-ui text-lg font-semibold">{c.label}</span>
                                <span className="text-sm text-graphite-soft">{c.account ?? providerName(c.provider, null)}</span>
                            </div>
                            <p className="text-sm">{syncedLine(c)}</p>
                            {c.last_error && c.enabled && <p className="text-sm text-casualty">{c.last_error}</p>}
                            <div className="flex flex-wrap gap-2">
                                {c.enabled && (
                                    <form action={syncCalendarNow}>
                                        <input type="hidden" name="id" value={c.id} />
                                        <Button type="submit" variant="outline" size="sm">Sync now</Button>
                                    </form>
                                )}
                                <form action={toggleCalendar}>
                                    <input type="hidden" name="id" value={c.id} />
                                    <input type="hidden" name="enabled" value={String(!c.enabled)} />
                                    <Button type="submit" variant="ghost" size="sm">{c.enabled ? 'Pause' : 'Turn back on'}</Button>
                                </form>
                                <form action={disconnectCalendar}>
                                    <input type="hidden" name="id" value={c.id} />
                                    <Button type="submit" variant="ghost" size="sm">Disconnect</Button>
                                </form>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {calendars.length < 5 && (
                <div className="grid gap-4">
                    {(providers.google || providers.outlook) && (
                        <div className="flex flex-wrap gap-2">
                            {/* Plain links: the routes redirect to Google/Microsoft, which a fetch can't follow. */}
                            {providers.google && (
                                <a href="/api/calendar-connect/google/start" className={buttonClasses('primary')}>
                                    Connect Google Calendar
                                </a>
                            )}
                            {providers.outlook && (
                                <a href="/api/calendar-connect/outlook/start" className={buttonClasses(providers.google ? 'outline' : 'primary')}>
                                    Connect Outlook
                                </a>
                            )}
                        </div>
                    )}
                    <details className="rounded-[3px] bg-primer-lift p-4">
                        <summary className="cfo-ui cursor-pointer font-semibold">Using an iPhone calendar?</summary>
                        <p className="mt-3 text-sm">
                            Apple doesn&apos;t offer a &ldquo;connect&rdquo; button like Google and Microsoft do, so iCloud calendars
                            connect with their share link instead. It takes about a minute.
                        </p>
                        <ol className="mt-2 ml-5 list-decimal space-y-1 text-sm">
                            {ICLOUD_STEPS.map((s) => (
                                <li key={s}>{s}</li>
                            ))}
                        </ol>
                        <form action={connectCalendar} className="mt-4 grid gap-3">
                            <div>
                                <Label htmlFor="cal-link" required>iCloud calendar link</Label>
                                <Input id="cal-link" name="link" required inputMode="url" autoComplete="off" spellCheck={false} placeholder="webcal://p42-caldav.icloud.com/published/2/..." className="text-sm" />
                            </div>
                            <input type="hidden" name="label" value="iCloud" />
                            <div>
                                <Button type="submit" variant="secondary">Connect iCloud calendar</Button>
                            </div>
                        </form>
                    </details>
                </div>
            )}
        </section>
    );
}
