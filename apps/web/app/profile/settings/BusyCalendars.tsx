import { Button, Input, Label } from '@cfo/ui';
import type { MyCalendar } from '@/lib/calendars';
import { providerName } from '@/lib/calendar-sync';
import { fmtShortDay, fmtTime } from '@/lib/time';
import { connectCalendar, disconnectCalendar, syncCalendarNow, toggleCalendar } from '../actions';

const HOW_TO: { name: string; steps: string[] }[] = [
    {
        name: 'iPhone or iCloud',
        steps: [
            'On your iPhone, open Calendar and tap Calendars at the bottom.',
            'Tap the ⓘ next to the calendar you use.',
            'Turn on Public Calendar, tap Share Link, then Copy.',
            'On a Mac: in Calendar, Control-click the calendar, choose Share Calendar, tick Public Calendar and copy the link.',
        ],
    },
    {
        name: 'Google Calendar',
        steps: [
            'On a computer, open calendar.google.com, click the gear, then Settings.',
            'Under "Settings for my calendars" on the left, pick your calendar and click Integrate calendar.',
            'Copy the "Secret address in iCal format".',
        ],
    },
    {
        name: 'Outlook',
        steps: [
            'In Outlook on the web, open Settings, then Calendar, then Shared calendars.',
            'Under "Publish a calendar", pick your calendar and choose "Can view when I’m busy".',
            'Click Publish and copy the ICS link.',
        ],
    },
];

function syncedLine(c: MyCalendar) {
    if (!c.enabled) return 'Paused. Planners don’t see it.';
    if (!c.last_synced_at) return 'Not synced yet.';
    const n = c.block_count;
    return `Synced ${fmtShortDay(c.last_synced_at)} at ${fmtTime(c.last_synced_at)}, with ${n} busy ${n === 1 ? 'stretch' : 'stretches'} in the next 90 days.`;
}

/** Profile settings: connect calendars so planners see "5 of 8 free". */
export function BusyCalendars({ calendars }: { calendars: MyCalendar[] }) {
    return (
        <section id="busy" aria-labelledby="busy-h" className="grid max-w-2xl gap-4 border-t border-graphite/15 py-10">
            <h2 id="busy-h" className="text-[2rem] font-extrabold">Your busy times, for planning</h2>
            <p>
                Connect your calendar and people planning a game day in your groups see how many members are free, for
                example &ldquo;5 of 8 free&rdquo;. They never see your name next to it, and nobody sees what you&apos;re doing.
            </p>
            <p className="text-sm text-graphite-soft">
                We keep only when you&apos;re busy, for the next 90 days. Titles, places and guests are thrown away as the
                calendar is read. Your link is stored encrypted, and disconnecting deletes it and your busy times. All-day
                events count as busy unless they&apos;re marked free. We check once a day.
            </p>

            {calendars.length > 0 && (
                <ul className="divide-y divide-graphite/15 border-y border-graphite/15">
                    {calendars.map((c) => (
                        <li key={c.id} className="grid gap-2 py-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                <span className="cfo-ui text-lg font-semibold">{c.label}</span>
                                <span className="text-sm text-graphite-soft">{providerName(c.source_host)}</span>
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
                <form action={connectCalendar} className="grid gap-4 rounded-[3px] bg-primer-lift p-5">
                    <div>
                        <Label htmlFor="cal-link" required>{calendars.length ? 'Add another calendar link' : 'Your calendar link'}</Label>
                        <Input id="cal-link" name="link" required inputMode="url" autoComplete="off" spellCheck={false} placeholder="webcal://p42-caldav.icloud.com/published/2/..." className="text-sm" />
                    </div>
                    <div>
                        <Label htmlFor="cal-label">Call it</Label>
                        <Input id="cal-label" name="label" maxLength={60} placeholder="Work, Family, Personal" />
                    </div>
                    <div className="grid gap-2">
                        <p className="cfo-ui font-semibold">Where to find the link</p>
                        {HOW_TO.map((h) => (
                            <details key={h.name} className="group">
                                <summary className="cfo-ui cursor-pointer text-gold-deep underline-offset-4 hover:underline">{h.name}</summary>
                                <ol className="mt-2 ml-5 list-decimal space-y-1 text-sm">
                                    {h.steps.map((s) => (
                                        <li key={s}>{s}</li>
                                    ))}
                                </ol>
                            </details>
                        ))}
                    </div>
                    <div>
                        <Button type="submit">Connect calendar</Button>
                    </div>
                </form>
            )}
        </section>
    );
}
