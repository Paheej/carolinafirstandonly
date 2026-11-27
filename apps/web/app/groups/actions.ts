'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';

/*
 * Group mutations. Everything except create/update goes through the
 * security-definer RPCs in 0011_groups.sql, which enforce the rules.
 * Actions are plain form actions: they redirect back with ?notice= or
 * ?error= so the pages work without client JS.
 */

async function db() {
    return createServerSupabase(await cookies());
}

function back(path: string, kind: 'notice' | 'error', message: string): never {
    const sep = path.includes('?') ? '&' : '?';
    redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

function field(fd: FormData, name: string): string {
    const v = fd.get(name);
    return typeof v === 'string' ? v.trim() : '';
}

/** Postgres raise messages arrive as error.message; keep them, they're written for people. */
function msg(e: { message: string } | null, fallback: string) {
    return e?.message || fallback;
}

function refresh(slug: string) {
    revalidatePath('/groups');
    revalidatePath(`/groups/${slug}`);
    revalidatePath(`/groups/${slug}/manage`);
}

function slugify(s: string) {
    return s
        .toLowerCase()
        .replace(/['"`&]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

function groupFields(fd: FormData) {
    const visibility = field(fd, 'visibility') === 'private' ? 'private' : 'public';
    const policy = field(fd, 'join_policy');
    return {
        name: field(fd, 'name'),
        description_md: field(fd, 'description_md') || null,
        systems: fd.getAll('systems').filter((v): v is string => typeof v === 'string' && v !== ''),
        visibility: visibility as 'public' | 'private',
        join_policy: (['open', 'request', 'invite'].includes(policy) ? policy : 'request') as
            | 'open'
            | 'request'
            | 'invite',
        banner_url: field(fd, 'banner_url') || null,
    };
}

export async function createGroup(fd: FormData) {
    const supabase = await db();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?next=/groups/new');

    const values = groupFields(fd);
    if (values.name.length < 2) back('/groups/new', 'error', 'Give the group a name.');
    const slug = slugify(field(fd, 'slug') || values.name);
    if (!slug) back('/groups/new', 'error', 'The web address needs at least one letter or number.');

    const { error } = await supabase.from('groups').insert({ ...values, slug, created_by: user.id });
    if (error) {
        back(
            '/groups/new',
            'error',
            error.code === '23505' ? `The address /groups/${slug} is taken. Pick another.` : error.message,
        );
    }
    revalidatePath('/groups');
    redirect(`/groups/${slug}?notice=${encodeURIComponent('Group created. You are its owner.')}`);
}

export async function updateGroup(fd: FormData) {
    const supabase = await db();
    const id = field(fd, 'group_id');
    const slug = field(fd, 'slug');
    const values = groupFields(fd);
    if (values.name.length < 2) back(`/groups/${slug}/manage`, 'error', 'Give the group a name.');
    const { error } = await supabase.from('groups').update(values).eq('id', id);
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', 'Settings saved.');
}

export async function deleteGroup(fd: FormData) {
    const supabase = await db();
    const id = field(fd, 'group_id');
    const slug = field(fd, 'slug');
    if (field(fd, 'confirm') !== slug) {
        back(`/groups/${slug}/manage`, 'error', `Type ${slug} to confirm deleting the group.`);
    }
    const { error, count } = await supabase.from('groups').delete({ count: 'exact' }).eq('id', id);
    if (error || !count) back(`/groups/${slug}/manage`, 'error', msg(error, 'Only the owner can delete the group.'));
    revalidatePath('/groups');
    back('/groups', 'notice', 'Group deleted.');
}

export async function joinGroup(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { data, error } = await supabase.rpc('join_group', {
        p_group: field(fd, 'group_id'),
        p_message: field(fd, 'message') || null,
    });
    if (error) back(`/groups/${slug}`, 'error', msg(error, 'Could not join.'));
    refresh(slug);
    back(
        `/groups/${slug}`,
        'notice',
        data === 'requested' ? 'Request sent. A group admin will review it.' : 'You joined the group.',
    );
}

export async function cancelRequest(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('cancel_join_request', { p_group: field(fd, 'group_id') });
    if (error) back(`/groups/${slug}`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}`, 'notice', 'Request withdrawn.');
}

export async function declineInvite(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('decline_invite', { p_group: field(fd, 'group_id') });
    if (error) back(`/groups/${slug}`, 'error', error.message);
    refresh(slug);
    back('/groups', 'notice', 'Invite declined.');
}

export async function leaveGroup(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('leave_group', { p_group: field(fd, 'group_id') });
    if (error) back(`/groups/${slug}`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}`, 'notice', 'You left the group.');
}

export async function decideRequest(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const approve = field(fd, 'decision') === 'approve';
    const { error } = await supabase.rpc('decide_join_request', {
        p_request: field(fd, 'request_id'),
        p_approve: approve,
    });
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', approve ? 'Request approved.' : 'Request declined.');
}

export async function inviteMember(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const username = field(fd, 'username');
    if (!username) back(`/groups/${slug}/manage`, 'error', 'Enter a username to invite.');
    const { error } = await supabase.rpc('invite_member', { p_group: field(fd, 'group_id'), p_username: username });
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', `Invite sent to ${username.replace(/^@/, '')}.`);
}

export async function createInviteLink(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const days = Number(field(fd, 'days')) || 14;
    const { error } = await supabase.rpc('create_invite_link', { p_group: field(fd, 'group_id'), p_days: days });
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', 'Invite link created.');
}

export async function revokeInvite(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('revoke_invite', { p_invite: field(fd, 'invite_id') });
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', 'Invite cancelled.');
}

export async function setMemberRole(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const role = field(fd, 'role');
    const { error } = await supabase.rpc('set_member_role', {
        p_group: field(fd, 'group_id'),
        p_user: field(fd, 'user_id'),
        p_role: role,
    });
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', role === 'owner' ? 'Ownership handed over.' : 'Role updated.');
}

export async function removeMember(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('remove_member', {
        p_group: field(fd, 'group_id'),
        p_user: field(fd, 'user_id'),
    });
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', 'Member removed.');
}

export async function savePinnedPost(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const groupId = field(fd, 'group_id');
    const id = field(fd, 'post_id');
    const title = field(fd, 'title');
    const body_md = field(fd, 'body_md');
    if (!title || !body_md) back(`/groups/${slug}/manage`, 'error', 'A pinned post needs a title and some text.');
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const { error } = id
        ? await supabase.from('group_pinned_posts').update({ title, body_md }).eq('id', id)
        : await supabase.from('group_pinned_posts').insert({ group_id: groupId, title, body_md, author_id: user?.id ?? null });
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', id ? 'Post updated.' : 'Post pinned.');
}

export async function deletePinnedPost(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.from('group_pinned_posts').delete().eq('id', field(fd, 'post_id'));
    if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    refresh(slug);
    back(`/groups/${slug}/manage`, 'notice', 'Post unpinned.');
}

// ---- Notifications ---------------------------------------------------------

export async function openNotification(fd: FormData) {
    const supabase = await db();
    const id = field(fd, 'id');
    const link = field(fd, 'link');
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    revalidatePath('/', 'layout');
    redirect(/^\/(?![/\\])/.test(link) ? link : '/profile/notifications');
}

export async function markAllRead() {
    const supabase = await db();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');
    await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
    revalidatePath('/', 'layout');
    redirect('/profile/notifications');
}

export async function redeemInviteLink(fd: FormData) {
    const supabase = await db();
    const token = field(fd, 'token');
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?next=/groups/invite/${token}`);
    const { data, error } = await supabase.rpc('redeem_invite_link', { p_token: token });
    if (error || !data) back(`/groups/invite/${token}`, 'error', msg(error, 'This invite link is no longer valid.'));
    refresh(data);
    back(`/groups/${data}`, 'notice', 'You joined the group.');
}
