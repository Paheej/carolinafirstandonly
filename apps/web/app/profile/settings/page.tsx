import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, Input, Label, PageHead, Textarea, buttonClasses } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getGameSystems } from '@/lib/archive';
import { Notice, first } from '@/app/groups/_components/Notice';
import { updateProfile } from '../actions';

export const metadata: Metadata = { title: 'Profile settings' };

export default async function ProfileSettingsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/profile/settings');
    const [sp, systems] = await Promise.all([searchParams, getGameSystems()]);
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
                        <Input id="username" name="username" required pattern="@?[a-z0-9_]{3,30}" defaultValue={p?.username ?? ''} />
                        <p className="mt-1 text-sm text-graphite-soft">Group admins invite you by this.</p>
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
        </>
    );
}
