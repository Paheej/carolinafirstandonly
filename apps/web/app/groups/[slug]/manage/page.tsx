import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, Input, Label, PageHead, Select, Textarea } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getGameSystems } from '@/lib/archive';
import {
    getGroupAdminQueue,
    getGroupBySlug,
    getGroupMembers,
    getPinnedPosts,
    getViewerState,
    memberName,
} from '@/lib/groups';
import {
    createInviteLink,
    decideRequest,
    deleteGroup,
    deletePinnedPost,
    inviteMember,
    removeMember,
    revokeInvite,
    savePinnedPost,
    setMemberRole,
    updateGroup,
} from '../../actions';
import { GroupFields } from '../../_components/GroupFields';
import { Notice, first } from '../../_components/Notice';

interface PageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = { title: 'Manage group' };

function fmt(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function ManageGroupPage({ params, searchParams }: PageProps) {
    const [{ slug }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
    if (!user) redirect(`/auth/login?next=/groups/${slug}/manage`);
    const group = await getGroupBySlug(slug);
    if (!group) notFound();

    const viewer = await getViewerState(group.id, user.id);
    const siteAdmin = !!user.profile?.is_admin;
    const isOwner = viewer.role === 'owner' || siteAdmin;
    if (!isOwner && viewer.role !== 'admin') notFound();

    const [members, posts, queue, systems, h] = await Promise.all([
        getGroupMembers(group.id),
        getPinnedPosts(group.id),
        getGroupAdminQueue(group.id),
        getGameSystems(),
        headers(),
    ]);
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get('host')}`;
    const hidden = { group_id: group.id, slug: group.slug };

    return (
        <>
            <PageHead
                kicker={<Link href={`/groups/${group.slug}`} className="no-underline hover:underline">{group.name}</Link>}
                title="Manage group"
            />
            <Notice notice={first(sp.notice)} error={first(sp.error)} />

            <div className="grid gap-14 py-12">
                {/* ---- Requests ---- */}
                <Section id="requests" title="Requests to join" count={queue.requests.length}>
                    {queue.requests.length === 0 ? (
                        <p className="text-graphite-soft">No one is waiting.</p>
                    ) : (
                        <ul className="border-t border-graphite/15">
                            {queue.requests.map((r) => (
                                <li key={r.id} className="grid gap-3 border-b border-graphite/15 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                    <div className="min-w-0">
                                        <p className="cfo-ui font-semibold">
                                            {memberName(r.profile)}{' '}
                                            <span className="font-normal text-graphite-soft">@{r.profile?.username}, asked {fmt(r.created_at)}</span>
                                        </p>
                                        {r.message ? <p className="mt-1 text-base text-graphite-soft">{r.message}</p> : null}
                                    </div>
                                    <form action={decideRequest} className="flex gap-2">
                                        <Hidden values={{ ...hidden, request_id: r.id }} />
                                        <Button type="submit" name="decision" value="approve" size="sm">Approve</Button>
                                        <Button type="submit" name="decision" value="decline" variant="ghost" size="sm">Decline</Button>
                                    </form>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>

                {/* ---- Invites ---- */}
                <Section id="invite" title="Invite people">
                    <div className="grid gap-10 md:grid-cols-2">
                        <form action={inviteMember} className="grid content-start gap-3">
                            <Hidden values={hidden} />
                            <Label htmlFor="username">By username</Label>
                            <div className="flex gap-2">
                                <Input id="username" name="username" required placeholder="@username" autoComplete="off" />
                                <Button type="submit">Invite</Button>
                            </div>
                            <p className="text-sm text-graphite-soft">They&apos;ll get a notification and can accept from the group page.</p>
                        </form>
                        <form action={createInviteLink} className="grid content-start gap-3">
                            <Hidden values={hidden} />
                            <Label htmlFor="days">With a link</Label>
                            <div className="flex gap-2">
                                <Select id="days" name="days" defaultValue="14" className="w-auto">
                                    <option value="1">Expires in 1 day</option>
                                    <option value="7">Expires in 7 days</option>
                                    <option value="14">Expires in 14 days</option>
                                    <option value="30">Expires in 30 days</option>
                                </Select>
                                <Button type="submit" variant="secondary">Make link</Button>
                            </div>
                            <p className="text-sm text-graphite-soft">Anyone with the link can join, even if the group is invite only.</p>
                        </form>
                    </div>

                    {queue.links.length > 0 || queue.invites.length > 0 ? (
                        <ul className="mt-8 border-t border-graphite/15">
                            {queue.links.map((l) => (
                                <li key={l.id} className="grid gap-2 border-b border-graphite/15 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                    <div className="min-w-0">
                                        <Input readOnly value={`${origin}/groups/invite/${l.token}`} aria-label="Invite link" className="cfo-num text-sm" />
                                        <p className="cfo-ui mt-1 text-sm text-graphite-soft">
                                            Used {l.uses} {l.uses === 1 ? 'time' : 'times'}
                                            {l.expires_at ? `, expires ${fmt(l.expires_at)}` : ''}
                                        </p>
                                    </div>
                                    <form action={revokeInvite}>
                                        <Hidden values={{ ...hidden, invite_id: l.id }} />
                                        <Button type="submit" variant="ghost" size="sm">Turn off link</Button>
                                    </form>
                                </li>
                            ))}
                            {queue.invites.map((i) => (
                                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite/15 py-3">
                                    <p className="cfo-ui">
                                        <span className="font-semibold">{memberName(i.profile)}</span>{' '}
                                        <span className="text-graphite-soft">invited {fmt(i.created_at)}, hasn&apos;t answered</span>
                                    </p>
                                    <form action={revokeInvite}>
                                        <Hidden values={{ ...hidden, invite_id: i.id }} />
                                        <Button type="submit" variant="ghost" size="sm">Cancel invite</Button>
                                    </form>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </Section>

                {/* ---- Members ---- */}
                <Section id="members" title="Members" count={members.length}>
                    <ul className="border-t border-graphite/15">
                        {members.map((m) => {
                            const self = m.user_id === user.id;
                            const canRemove = m.role === 'member' || (m.role === 'admin' && isOwner);
                            return (
                                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite/15 py-3">
                                    <p className="cfo-ui">
                                        <span className="font-semibold">{memberName(m.profile)}</span>{' '}
                                        <span className="text-graphite-soft">@{m.profile?.username}{self ? ' (you)' : ''}</span>
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {isOwner && m.role !== 'owner' ? (
                                            <form action={setMemberRole} className="flex items-center gap-2">
                                                <Hidden values={{ ...hidden, user_id: m.user_id }} />
                                                <label htmlFor={`role-${m.user_id}`} className="sr-only">Role for {memberName(m.profile)}</label>
                                                <Select id={`role-${m.user_id}`} name="role" defaultValue={m.role} className="h-9 w-auto">
                                                    <option value="member">Member</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="owner">Owner (hands over ownership)</option>
                                                </Select>
                                                <Button type="submit" variant="outline" size="sm">Set role</Button>
                                            </form>
                                        ) : (
                                            <span className="cfo-ui text-sm text-gold-deep">
                                                {m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Member'}
                                            </span>
                                        )}
                                        {!self && m.role !== 'owner' && canRemove ? (
                                            <form action={removeMember}>
                                                <Hidden values={{ ...hidden, user_id: m.user_id }} />
                                                <Button type="submit" variant="ghost" size="sm">Remove</Button>
                                            </form>
                                        ) : null}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {isOwner ? null : (
                        <p className="mt-3 text-sm text-graphite-soft">Only the owner can change roles or remove admins.</p>
                    )}
                </Section>

                {/* ---- Pinned posts ---- */}
                <Section id="pinned" title="Pinned posts">
                    <div className="grid gap-6">
                        {posts.map((p) => (
                            <details key={p.id} className="rounded-[3px] bg-primer-lift p-4">
                                <summary className="cfo-ui cursor-pointer font-semibold">{p.title}</summary>
                                <form action={savePinnedPost} className="mt-4 grid gap-3">
                                    <Hidden values={{ ...hidden, post_id: p.id }} />
                                    <PostFields title={p.title} body={p.body_md} id={p.id} />
                                    <div className="flex gap-2">
                                        <Button type="submit" size="sm">Save post</Button>
                                        <Button type="submit" formAction={deletePinnedPost} variant="danger" size="sm">Unpin</Button>
                                    </div>
                                </form>
                            </details>
                        ))}
                        <form action={savePinnedPost} className="grid gap-3">
                            <Hidden values={hidden} />
                            <PostFields id="new" />
                            <div>
                                <Button type="submit" variant="secondary">Pin post</Button>
                            </div>
                        </form>
                    </div>
                </Section>

                {/* ---- Settings ---- */}
                <Section id="settings" title="Settings">
                    <form action={updateGroup} className="max-w-3xl">
                        <Hidden values={hidden} />
                        <GroupFields group={group} systems={systems} />
                        <div className="mt-6">
                            <Button type="submit">Save settings</Button>
                        </div>
                    </form>
                </Section>

                {isOwner ? (
                    <Section id="delete" title="Delete group">
                        <form action={deleteGroup} className="grid max-w-xl gap-3">
                            <Hidden values={hidden} />
                            <p className="text-graphite-soft">
                                This removes the group, its members list and pinned posts. It can&apos;t be undone.
                            </p>
                            <Label htmlFor="confirm">Type {group.slug} to confirm</Label>
                            <div className="flex gap-2">
                                <Input id="confirm" name="confirm" autoComplete="off" />
                                <Button type="submit" variant="danger">Delete group</Button>
                            </div>
                        </form>
                    </Section>
                ) : null}
            </div>
        </>
    );
}

function Section({ id, title, count, children }: { id: string; title: string; count?: number; children: React.ReactNode }) {
    return (
        <section aria-labelledby={`${id}-h`} className="min-w-0">
            <h2 id={`${id}-h`} className="mb-5 text-[2rem] font-extrabold">
                {title}
                {count ? <span className="cfo-num ml-3 text-[1.25rem] text-gold-deep">{count}</span> : null}
            </h2>
            {children}
        </section>
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

function PostFields({ id, title, body }: { id: string; title?: string; body?: string }) {
    return (
        <>
            <div>
                <Label htmlFor={`title-${id}`}>Title</Label>
                <Input id={`title-${id}`} name="title" required defaultValue={title} placeholder="House rules" />
            </div>
            <div>
                <Label htmlFor={`body-${id}`}>Text (markdown)</Label>
                <Textarea id={`body-${id}`} name="body_md" required rows={5} defaultValue={body} />
            </div>
        </>
    );
}
