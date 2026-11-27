import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerSupabase } from '@cfo/database/server';
import { PageHead, buttonClasses } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getGroups } from '@/lib/groups';

interface PageProps {
    params: Promise<{ username: string }>;
}

async function getProfileByUsername(username: string) {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, preferred_systems, created_at')
        .ilike('username', username.replace(/[%_\\]/g, '\\$&'))
        .maybeSingle();
    return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const p = await getProfileByUsername((await params).username);
    return { title: p ? (p.display_name ?? p.username) : 'Member not found' };
}

export default async function PublicProfilePage({ params }: PageProps) {
    const [{ username }, viewer] = await Promise.all([params, getCurrentUser()]);
    const p = await getProfileByUsername(decodeURIComponent(username));
    if (!p) notFound();

    // Groups the viewer can see that this person belongs to.
    const supabase = createServerSupabase(await cookies());
    const [{ data: memberships }, groups] = await Promise.all([
        supabase.from('group_members').select('group_id').eq('user_id', p.id),
        getGroups(viewer?.id ?? null),
    ]);
    const ids = new Set((memberships ?? []).map((m) => m.group_id));
    const theirGroups = groups.filter((g) => ids.has(g.id));
    const since = new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <>
            <PageHead
                kicker={`@${p.username}`}
                title={p.display_name ?? p.username}
                lede={`Member since ${since}`}
                actions={
                    viewer?.id === p.id ? (
                        <Link href="/profile/settings" className={buttonClasses('outline', 'sm')}>
                            Edit profile
                        </Link>
                    ) : null
                }
            />
            <div className="grid gap-12 py-12 md:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
                <div className="min-w-0">
                    {p.bio ? <p className="max-w-[60ch] whitespace-pre-line">{p.bio}</p> : <p className="text-graphite-soft">No bio yet.</p>}
                    {p.preferred_systems?.length ? (
                        <p className="cfo-ui mt-5 font-semibold text-gold-deep">Plays {p.preferred_systems.join(', ')}</p>
                    ) : null}
                </div>
                <section aria-labelledby="groups-h">
                    <h2 id="groups-h" className="mb-3 text-[1.5rem] font-bold">Groups</h2>
                    {theirGroups.length === 0 ? (
                        <p className="text-base text-graphite-soft">Not in any groups you can see.</p>
                    ) : (
                        <ul className="cfo-ui grid gap-2">
                            {theirGroups.map((g) => (
                                <li key={g.id}>
                                    <Link href={`/groups/${g.slug}`} className="text-[1.05rem] font-semibold no-underline cfo-link-hover">
                                        {g.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
