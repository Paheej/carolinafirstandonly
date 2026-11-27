import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, MarkdownRender, PageHead, Textarea, buttonClasses } from '@cfo/ui';
import { Settings } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getGroupBySlug, getGroupMembers, getPinnedPosts, getViewerState, memberName } from '@/lib/groups';
import { excerpt } from '@/lib/markdown';
import { cancelRequest, declineInvite, joinGroup, leaveGroup } from '../actions';
import { Notice, first } from '../_components/Notice';
import { POLICY_LABEL } from '../_components/GroupFields';

interface PageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const group = await getGroupBySlug((await params).slug);
    if (!group) return { title: 'Group not found' };
    return { title: group.name, description: excerpt(group.description_md, 160) ?? undefined };
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: null } as const;

export default async function GroupPage({ params, searchParams }: PageProps) {
    const [{ slug }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
    const group = await getGroupBySlug(slug);
    if (!group) notFound();

    const [members, posts, viewer] = await Promise.all([
        getGroupMembers(group.id),
        getPinnedPosts(group.id),
        getViewerState(group.id, user?.id ?? null),
    ]);
    const canManage = viewer.role === 'owner' || viewer.role === 'admin' || !!user?.profile?.is_admin;
    const hidden = { group_id: group.id, slug: group.slug };

    return (
        <>
            <PageHead
                kicker={<Link href="/groups" className="no-underline hover:underline">Groups</Link>}
                title={group.name}
                actions={
                    canManage ? (
                        <Link href={`/groups/${group.slug}/manage`} className={buttonClasses('outline', 'sm')}>
                            <Settings size={14} /> Manage group
                        </Link>
                    ) : null
                }
            >
                <p className="cfo-ui cfo-num mt-5 flex flex-wrap gap-x-5 gap-y-1 text-on-mat-soft">
                    <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
                    {group.systems.length > 0 ? <span>{group.systems.join(', ')}</span> : null}
                    <span>{group.visibility === 'private' ? 'Private group' : POLICY_LABEL[group.join_policy]}</span>
                </p>
            </PageHead>
            <Notice notice={first(sp.notice)} error={first(sp.error)} />

            {group.banner_url ? (
                <img src={group.banner_url} alt="" className="mt-8 aspect-[3/1] w-full rounded-[3px] bg-mat-raised object-cover" />
            ) : null}

            <div className="grid gap-12 py-12 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
                <div className="grid min-w-0 content-start gap-10">
                    {group.description_md ? (
                        <MarkdownRender source={group.description_md} />
                    ) : (
                        <p className="text-graphite-soft">No description yet.</p>
                    )}

                    {posts.length > 0 ? (
                        <section aria-labelledby="pinned-h" className="grid gap-6">
                            <h2 id="pinned-h" className="text-[2rem] font-extrabold">Pinned</h2>
                            {posts.map((p) => (
                                <article key={p.id} className="border-l-2 border-gold pl-5">
                                    <h3 className="mb-2 text-[1.5rem] font-bold">{p.title}</h3>
                                    <MarkdownRender source={p.body_md} />
                                </article>
                            ))}
                        </section>
                    ) : null}
                </div>

                <aside className="grid content-start gap-8">
                    <section className="rounded-[3px] bg-primer-lift p-5">
                        <Membership
                            signedIn={!!user}
                            slug={group.slug}
                            policy={group.join_policy}
                            viewer={viewer}
                            hidden={hidden}
                        />
                    </section>

                    <section aria-labelledby="members-h">
                        <h2 id="members-h" className="mb-3 text-[1.5rem] font-bold">Members</h2>
                        {user ? (
                            <ul className="cfo-ui grid gap-1.5">
                                {members.map((m) => (
                                    <li key={m.user_id} className="flex items-baseline justify-between gap-3">
                                        <span className="font-semibold">{memberName(m.profile)}</span>
                                        {ROLE_LABEL[m.role] ? (
                                            <span className="text-sm text-gold-deep">{ROLE_LABEL[m.role]}</span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-base text-graphite-soft">
                                <Link href={`/auth/login?next=/groups/${group.slug}`} className="cfo-link">Sign in</Link> to see who&apos;s in this group.
                            </p>
                        )}
                    </section>
                </aside>
            </div>
        </>
    );
}

function Hidden({ values }: { values: Record<string, string> }) {
    return (
        <>
            {Object.entries(values).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
            ))}
        </>
    );
}

function Membership({
    signedIn,
    slug,
    policy,
    viewer,
    hidden,
}: {
    signedIn: boolean;
    slug: string;
    policy: 'open' | 'request' | 'invite';
    viewer: Awaited<ReturnType<typeof getViewerState>>;
    hidden: Record<string, string>;
}) {
    if (!signedIn) {
        return (
            <>
                <h2 className="mb-2 text-[1.5rem] font-bold">Play with this group</h2>
                <p className="mb-4 text-base text-graphite-soft">Sign in or create an account to join.</p>
                <Link href={`/auth/login?next=/groups/${slug}`} className={buttonClasses('primary')}>Sign in to join</Link>
            </>
        );
    }
    if (viewer.role) {
        return (
            <>
                <h2 className="mb-2 text-[1.5rem] font-bold">You&apos;re in this group</h2>
                {viewer.role === 'owner' ? (
                    <p className="text-base text-graphite-soft">You own it. To leave, make someone else the owner from Manage group.</p>
                ) : (
                    <form action={leaveGroup}>
                        <Hidden values={hidden} />
                        <Button type="submit" variant="ghost" size="sm">Leave group</Button>
                    </form>
                )}
            </>
        );
    }
    if (viewer.pendingInvite) {
        return (
            <>
                <h2 className="mb-2 text-[1.5rem] font-bold">You&apos;re invited</h2>
                <div className="flex flex-wrap gap-2">
                    <form action={joinGroup}>
                        <Hidden values={hidden} />
                        <Button type="submit">Accept invite</Button>
                    </form>
                    <form action={declineInvite}>
                        <Hidden values={hidden} />
                        <Button type="submit" variant="ghost">Decline</Button>
                    </form>
                </div>
            </>
        );
    }
    if (viewer.pendingRequest) {
        return (
            <>
                <h2 className="mb-2 text-[1.5rem] font-bold">Request sent</h2>
                <p className="mb-4 text-base text-graphite-soft">A group admin will approve or decline it. You&apos;ll get a notification either way.</p>
                <form action={cancelRequest}>
                    <Hidden values={hidden} />
                    <Button type="submit" variant="ghost" size="sm">Withdraw request</Button>
                </form>
            </>
        );
    }
    if (policy === 'open') {
        return (
            <form action={joinGroup}>
                <Hidden values={hidden} />
                <h2 className="mb-2 text-[1.5rem] font-bold">Play with this group</h2>
                <p className="mb-4 text-base text-graphite-soft">Anyone can join.</p>
                <Button type="submit">Join group</Button>
            </form>
        );
    }
    if (policy === 'request') {
        return (
            <form action={joinGroup} className="grid gap-3">
                <Hidden values={hidden} />
                <h2 className="text-[1.5rem] font-bold">Ask to join</h2>
                <label htmlFor="message" className="cfo-ui text-graphite-soft">Note to the admins (optional)</label>
                <Textarea id="message" name="message" rows={3} maxLength={500} placeholder="Who you are, what you play" />
                <div>
                    <Button type="submit">Send request</Button>
                </div>
            </form>
        );
    }
    return (
        <>
            <h2 className="mb-2 text-[1.5rem] font-bold">Invite only</h2>
            <p className="text-base text-graphite-soft">Ask a member of this group to have an admin invite you.</p>
        </>
    );
}
