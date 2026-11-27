import Link from 'next/link';
import type { EventListItem } from '@/lib/events';
import { fmtShortDay, fmtTimeRange, monthKey, utcToZonedParts } from '@/lib/time';

const STATUS_LABEL = { yes: "You're going", maybe: 'You said maybe', waitlist: "You're on the waitlist", no: "You can't make it" } as const;

/** Ruled list of game days, grouped under month headings. */
export function EventList({ events, showMonths = true }: { events: EventListItem[]; showMonths?: boolean }) {
    const months: [string, EventListItem[]][] = [];
    for (const e of events) {
        const k = monthKey(e.starts_at);
        const last = months[months.length - 1];
        if (last && last[0] === k) last[1].push(e);
        else months.push([k, [e]]);
    }
    return (
        <div className="grid gap-10">
            {months.map(([month, list]) => (
                <section key={month} aria-label={month}>
                    {showMonths ? <h2 className="mb-3 text-[1.75rem] font-extrabold">{month}</h2> : null}
                    <ul className="border-t border-graphite/15">
                        {list.map((e) => {
                            const day = utcToZonedParts(e.starts_at).date.slice(8);
                            return (
                                <li key={e.id} className="border-b border-graphite/15">
                                    <Link href={`/events/${e.slug}`} className="group grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-4 no-underline sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
                                        <div className="row-span-2 grid content-start text-center" aria-hidden="true">
                                            <span className="cfo-ui text-sm font-semibold text-graphite-soft">{fmtShortDay(e.starts_at).split(',')[0]}</span>
                                            <span className="cfo-num font-display text-[2rem] font-extrabold leading-none [font-stretch:72%]">{Number(day)}</span>
                                        </div>
                                        <h3 className={`text-[1.5rem] font-bold decoration-gold underline-offset-4 group-hover:underline ${e.cancelled_at ? 'line-through decoration-casualty' : ''}`}>
                                            {e.title}
                                        </h3>
                                        <p className="cfo-ui cfo-num col-start-2 text-graphite-soft sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:text-right">
                                            {e.cancelled_at ? (
                                                <span className="font-semibold text-casualty">Cancelled</span>
                                            ) : (
                                                <>
                                                    {e.going} going{e.capacity ? ` of ${e.capacity}` : ''}
                                                    {e.my_status ? (
                                                        <span className={`block font-semibold ${e.my_status === 'yes' ? 'text-gold-deep' : ''}`}>{STATUS_LABEL[e.my_status]}</span>
                                                    ) : null}
                                                </>
                                            )}
                                        </p>
                                        <p className="cfo-ui col-start-2 text-graphite-soft">
                                            <span className="sr-only">{fmtShortDay(e.starts_at)}, </span>
                                            {fmtTimeRange(e.starts_at, e.ends_at)}
                                            {e.location ? `, ${e.location}` : ''}
                                            {e.group ? <span className="text-gold-deep"> {e.group.name}</span> : null}
                                        </p>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
