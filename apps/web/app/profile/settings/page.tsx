import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, Input, Label, PageHead, Textarea, buttonClasses } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getGameSystems } from '@/lib/archive';
import { Notice, first } from '@/app/groups/_components/Notice';
import { updateProfile } from '../actions';
import { deleteFeed, rotateFeed } from '@/app/events/actions';
import { getMyFeedToken } from '@/lib/events';
import { headers } from 'next/headers';
import { getMyCalendars } from '@/lib/calendars';
import { BusyCalendars } from './BusyCalendars';
import { oauthConfigured } from '@/lib/calendar-oauth';

export const metadata: Metadata = { title: 'Profile settings' };

export default async function ProfileSettingsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/profile/settings');
    const [sp, systems, token, h, calendars] = await Promise.all([
        searchParams,
        getGameSystems(),
        getMyFeedToken(user.id),
        headers(),
        getMyCalendars(),
    ]);
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get('host')}`;
    const feedUrl = token ? `${origin}/api/calendar/${token}.ics` : null;
    const p = user.profile;

    return (
        <>
            <PageHead
                kicker="Profile"
                title="Settings"
                actions={
                    p ? (
                        <Link href={`/profile/${p.username}`} className={buttonClasses('outline', 'sm')}>
                            See your profile
                        </Link>
                    ) : null
                }
            />
            <Notice notice={first(sp.notice)} error={first(sp.error)} />
            <form action={updateProfile} className="grid max-w-2xl gap-5 py-10">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <Label htmlFor="display_name">Name</Label>
                        <Input id="display_name" name="display_name" maxLength={60} defaultValue={p?.display_name ?? ''} placeholder="What people call you" />
                    </div>
                    <div>
                        <Label htmlFor="username" required>Username</Label>
                        <Input
                            id="username"
                            name="username"
                            required
                            pattern="@?[A-Za-z0-9_]{3,30}"
                            title="3 to 30 letters, numbers or underscores, no spaces"
                            autoCapitalize="none"
                            autoComplete="username"
                            defaultValue={p?.username ?? ''}
                        />
                        <p className="mt-1 text-sm text-graphite-soft">Letters, numbers and underscores. Group admins invite you by this.</p>
                    </div>
                </div>
                <div>
                    <Label htmlFor="bio">About you</Label>
                    <Textarea id="bio" name="bio" rows={4} maxLength={600} defaultValue={p?.bio ?? ''} placeholder="Armies, characters, what you're painting" />
                </div>
                <fieldset>
                    <legend className="cfo-ui mb-2 font-semibold">Games you play</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {systems.map((s) => (
                            <label key={s.id} className="cfo-ui inline-flex items-center gap-2">
                                <input type="checkbox" name="systems" value={s.name} defaultChecked={p?.preferred_systems?.includes(s.name)} className="size-4 accent-gold" />
                                {s.name}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <p className="cfo-ui text-graphite-soft">Signed in as {user.email}</p>
                <div>
                    <Button type="submit">Save profile</Button>
                </div>
            </form>

            <section id="calendar" aria-labelledby="calendar-h" className="grid max-w-2xl gap-4 border-t border-graphite/15 py-10">
                <h2 id="calendar-h" className="text-[2rem] font-extrabold">Your game days in your calendar</h2>
                <p>
                    Subscribe once and every game day you&apos;re going to (or might go to) shows up in Google, Apple or
                    Outlook Calendar, and moves or disappears when it changes or is cancelled.
                </p>
                {feedUrl ? (
                    <>
                        <div>
                            <Label htmlFor="feed">Your private calendar link</Label>
                            <Input id="feed" readOnly value={feedUrl} className="cfo-num text-sm" />
                            <p className="mt-1 text-sm text-graphite-soft">
                                Anyone with this link can see your game days, so keep it to yourself. Make a new one if it leaks.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <a href={feedUrl.replace(/^https?:/, 'webcal:')} className={buttonClasses('primary')}>
                                Open in Apple Calendar
                            </a>
                            <a
                                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl.replace(/^https?:/, 'webcal:'))}`}
                                className={buttonClasses('outline')}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Add to Google Calendar
                            </a>
                            <a
                                href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent('CF&O game days')}`}
                                className={buttonClasses('outline')}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Add to Outlook
                            </a>
                        </div>
                        <p className="text-sm text-graphite-soft">
                            Google and Outlook check subscribed calendars every few hours, so changes can take a while to show up there.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <form action={rotateFeed}>
                                <Button type="submit" variant="ghost" size="sm">Make a new link</Button>
                            </form>
                            <form action={deleteFeed}>
                                <Button type="submit" variant="ghost" size="sm">Turn off the link</Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <form action={rotateFeed}>
                        <Button type="submit">Make my calendar link</Button>
                    </form>
                )}
            </section>
            <BusyCalendars calendars={calendars} providers={{ google: oauthConfigured('google') }} />
        </>
    );
}
