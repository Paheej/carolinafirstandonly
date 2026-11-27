import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import type { EventRole, EventRsvp, GameDay, Group, GroupRoleTemplate } from '@cfo/database/types';
import { getProfiles, type MemberProfile } from './groups';

/**
 * Server-side reads for game days. RLS decides what each viewer can see;
 * mutations live in app/events/actions.ts and go through RPCs.
 */

async function db() {
    return createServerSupabase(await cookies());
}

export interface EventListItem extends GameDay {
    group: Pick<Group, 'id' | 'slug' | 'name'> | null;
    going: number;
    my_status: EventRsvp['status'] | null;
}

export async function listEvents(
    viewerId: string | null,
    opts: { groupId?: string; past?: boolean; limit?: number } = {},
): Promise<EventListItem[]> {
    const supabase = await db();
    const now = new Date().toISOString();
    let q = supabase.from('events').select('*');
    q = opts.past ? q.lt('ends_at', now).order('starts_at', { ascending: false }) : q.gte('ends_at', now).order('starts_at');
    if (opts.groupId) q = q.eq('group_id', opts.groupId);
    if (opts.limit) q = q.limit(opts.limit);
    const { data: events } = await q;
    if (!events?.length) return [];

    const ids = events.map((e) => e.id);
    const groupIds = [...new Set(events.flatMap((e) => (e.group_id ? [e.group_id] : [])))];
    const [{ data: rsvps }, { data: groups }] = await Promise.all([
        supabase.from('event_rsvps').select('event_id, user_id, status').in('event_id', ids),
        groupIds.length
            ? supabase.from('groups').select('id, slug, name').in('id', groupIds)
            : Promise.resolve({ data: [] as Pick<Group, 'id' | 'slug' | 'name'>[] }),
    ]);
    const groupMap = new Map((groups ?? []).map((g) => [g.id, g]));
    return events.map((e) => {
        const mine = (rsvps ?? []).filter((r) => r.event_id === e.id);
        return {
            ...e,
            group: e.group_id ? groupMap.get(e.group_id) ?? null : null,
            going: mine.filter((r) => r.status === 'yes').length,
            my_status: mine.find((r) => r.user_id === viewerId)?.status ?? null,
        };
    });
}

/** The next game day the viewer can see that isn't cancelled. */
export async function getNextGameDay(viewerId: string | null): Promise<EventListItem | null> {
    const events = await listEvents(viewerId, { limit: 6 });
    return events.find((e) => !e.cancelled_at) ?? null;
}

export async function getEventBySlug(slug: string): Promise<GameDay | null> {
    const supabase = await db();
    const { data } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
    return data;
}

export interface RsvpRow extends EventRsvp {
    profile: MemberProfile | null;
}

export async function getEventDetail(eventId: string, viewerId: string | null) {
    const supabase = await db();
    const [{ data: roles }, { data: rsvps }, manage] = await Promise.all([
        supabase.from('event_roles').select('*').eq('event_id', eventId).order('position'),
        supabase.from('event_rsvps').select('*').eq('event_id', eventId),
        viewerId
            ? supabase.rpc('can_manage_event', { eid: eventId, uid: viewerId })
            : Promise.resolve({ data: false }),
    ]);
    const profiles = await getProfiles((rsvps ?? []).map((r) => r.user_id));
    const rows: RsvpRow[] = (rsvps ?? []).map((r) => ({ ...r, profile: profiles.get(r.user_id) ?? null }));
    return {
        roles: (roles ?? []) as EventRole[],
        rsvps: rows,
        mine: rows.find((r) => r.user_id === viewerId) ?? null,
        canManage: !!manage.data,
    };
}

export async function getEventInvites(eventId: string) {
    const supabase = await db();
    const { data } = await supabase.from('event_invites').select('user_id, created_at').eq('event_id', eventId);
    const profiles = await getProfiles((data ?? []).map((i) => i.user_id));
    return (data ?? []).map((i) => ({ ...i, profile: profiles.get(i.user_id) ?? null }));
}

export interface PlannerGroup extends Pick<Group, 'id' | 'slug' | 'name'> {
    templates: Pick<GroupRoleTemplate, 'role_name' | 'default_max'>[];
}

/** Groups the viewer belongs to, with role templates, for the event form. */
export async function getPlannerGroups(viewerId: string): Promise<PlannerGroup[]> {
    const supabase = await db();
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', viewerId);
    const ids = (memberships ?? []).map((m) => m.group_id);
    if (ids.length === 0) return [];
    const [{ data: groups }, { data: templates }] = await Promise.all([
        supabase.from('groups').select('id, slug, name').in('id', ids).order('name'),
        supabase.from('group_role_templates').select('group_id, role_name, default_max, position').in('group_id', ids).order('position'),
    ]);
    return (groups ?? []).map((g) => ({
        ...g,
        templates: (templates ?? []).filter((t) => t.group_id === g.id).map(({ role_name, default_max }) => ({ role_name, default_max })),
    }));
}

export async function getRoleTemplates(groupId: string): Promise<GroupRoleTemplate[]> {
    const supabase = await db();
    const { data } = await supabase.from('group_role_templates').select('*').eq('group_id', groupId).order('position');
    return data ?? [];
}

export async function getMyFeedToken(viewerId: string): Promise<string | null> {
    const supabase = await db();
    const { data } = await supabase.from('user_calendar_feeds').select('token').eq('user_id', viewerId).maybeSingle();
    return data?.token ?? null;
}
