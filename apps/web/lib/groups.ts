import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import type {
    Group,
    GroupInvite,
    GroupJoinRequest,
    GroupPinnedPost,
    GroupRole,
    Notification,
    Profile,
} from '@cfo/database/types';

/**
 * Server-side data access for groups. Membership changes happen through
 * the security-definer RPCs in 0011_groups.sql (see app/groups/actions.ts);
 * this file is read-only.
 */

export type MemberProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

export interface MemberRow {
    user_id: string;
    role: GroupRole;
    joined_at: string;
    profile: MemberProfile | null;
}

export interface GroupListItem extends Group {
    member_count: number;
    my_role: GroupRole | null;
}

async function db() {
    return createServerSupabase(await cookies());
}

const PROFILE_COLS = 'id, username, display_name, avatar_url';

/** Groups the viewer can see (RLS: public ones plus their private ones), with counts. */
export async function getGroups(viewerId: string | null): Promise<GroupListItem[]> {
    const supabase = await db();
    const [{ data: groups }, { data: members }] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('group_members').select('group_id, user_id, role'),
    ]);
    const counts = new Map<string, number>();
    const mine = new Map<string, GroupRole>();
    for (const m of members ?? []) {
        counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
        if (m.user_id === viewerId) mine.set(m.group_id, m.role);
    }
    return (groups ?? []).map((g) => ({
        ...g,
        member_count: counts.get(g.id) ?? 0,
        my_role: mine.get(g.id) ?? null,
    }));
}

export async function getGroupBySlug(slug: string): Promise<Group | null> {
    const supabase = await db();
    const { data } = await supabase.from('groups').select('*').eq('slug', slug).maybeSingle();
    return data;
}

const ROLE_ORDER: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };

export async function getGroupMembers(groupId: string): Promise<MemberRow[]> {
    const supabase = await db();
    const { data: rows } = await supabase
        .from('group_members')
        .select('user_id, role, joined_at')
        .eq('group_id', groupId);
    const profiles = await getProfiles((rows ?? []).map((r) => r.user_id));
    return (rows ?? [])
        .map((r) => ({ ...r, profile: profiles.get(r.user_id) ?? null }))
        .sort(
            (a, b) =>
                ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
                memberName(a.profile).localeCompare(memberName(b.profile)),
        );
}

export async function getProfiles(ids: string[]): Promise<Map<string, MemberProfile>> {
    if (ids.length === 0) return new Map();
    const supabase = await db();
    const { data } = await supabase.from('profiles').select(PROFILE_COLS).in('id', ids);
    return new Map((data ?? []).map((p) => [p.id, p]));
}

export function memberName(p: MemberProfile | null): string {
    return p?.display_name || p?.username || 'Unknown member';
}

export async function getPinnedPosts(groupId: string): Promise<GroupPinnedPost[]> {
    const supabase = await db();
    const { data } = await supabase
        .from('group_pinned_posts')
        .select('*')
        .eq('group_id', groupId)
        .order('position')
        .order('created_at', { ascending: false });
    return data ?? [];
}

/** What the viewer's relationship to a group is, for the join button. */
export interface ViewerState {
    role: GroupRole | null;
    pendingRequest: boolean;
    pendingInvite: boolean;
}

export async function getViewerState(groupId: string, viewerId: string | null): Promise<ViewerState> {
    if (!viewerId) return { role: null, pendingRequest: false, pendingInvite: false };
    const supabase = await db();
    const [{ data: member }, { data: request }, { data: invite }] = await Promise.all([
        supabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', viewerId).maybeSingle(),
        supabase
            .from('group_join_requests')
            .select('id')
            .eq('group_id', groupId)
            .eq('user_id', viewerId)
            .eq('status', 'pending')
            .maybeSingle(),
        supabase
            .from('group_invites')
            .select('id')
            .eq('group_id', groupId)
            .eq('invited_user_id', viewerId)
            .eq('status', 'pending')
            .maybeSingle(),
    ]);
    return { role: member?.role ?? null, pendingRequest: !!request, pendingInvite: !!invite };
}

export interface RequestRow extends GroupJoinRequest {
    profile: MemberProfile | null;
}

export interface InviteRow extends GroupInvite {
    profile: MemberProfile | null;
}

/** For the manage page: open requests, pending invites and live links. RLS limits this to group admins. */
export async function getGroupAdminQueue(groupId: string) {
    const supabase = await db();
    const [{ data: requests }, { data: invites }] = await Promise.all([
        supabase
            .from('group_join_requests')
            .select('*')
            .eq('group_id', groupId)
            .eq('status', 'pending')
            .order('created_at'),
        supabase
            .from('group_invites')
            .select('*')
            .eq('group_id', groupId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }),
    ]);
    const ids = [
        ...(requests ?? []).map((r) => r.user_id),
        ...(invites ?? []).flatMap((i) => (i.invited_user_id ? [i.invited_user_id] : [])),
    ];
    const profiles = await getProfiles(ids);
    const now = Date.now();
    return {
        requests: (requests ?? []).map((r) => ({ ...r, profile: profiles.get(r.user_id) ?? null })) as RequestRow[],
        invites: (invites ?? [])
            .filter((i) => i.kind === 'direct')
            .map((i) => ({ ...i, profile: profiles.get(i.invited_user_id ?? '') ?? null })) as InviteRow[],
        links: (invites ?? []).filter(
            (i) =>
                i.kind === 'link' &&
                (!i.expires_at || new Date(i.expires_at).getTime() > now) &&
                (i.max_uses == null || i.uses < i.max_uses),
        ),
    };
}

// ---- Notifications ---------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
    const supabase = await db();
    const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);
    return count ?? 0;
}

export async function getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    const supabase = await db();
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    return data ?? [];
}
