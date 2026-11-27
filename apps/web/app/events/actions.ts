'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import { zonedToUtcIso } from '@/lib/time';

/*
 * Game-day mutations. Plain form actions that redirect back with
 * ?notice= / ?error= (same pattern as app/groups/actions.ts). RSVPs, invites
 * and cancellation go through the RPCs in 0013_events.sql.
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

function all(fd: FormData, name: string): string[] {
    return fd.getAll(name).map((v) => (typeof v === 'string' ? v.trim() : ''));
}

function slugify(s: string) {
    return s
        .toLowerCase()
        .replace(/['"`&]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

function refresh(slug?: string) {
    revalidatePath('/');
    revalidatePath('/events');
    if (slug) revalidatePath(`/events/${slug}`);
}

interface RoleInput {
    id: string;
    role_name: string;
    max_count: number | null;
    position: number;
}

/** Validates the shared fields; returns the row or an error message. */
function readEvent(fd: FormData) {
    const title = field(fd, 'title');
    const date = field(fd, 'date');
    const start = field(fd, 'start');
    const end = field(fd, 'end');
    const groupId = field(fd, 'group_id') || null;
    const visibility = field(fd, 'visibility') as 'public' | 'group' | 'hidden';
    const capacityRaw = field(fd, 'capacity');

    if (title.length < 2) return { error: 'Give the game day a title.' } as const;
    const starts_at = zonedToUtcIso(date, start);
    let ends_at = zonedToUtcIso(date, end);
    if (!starts_at || !ends_at) return { error: 'Pick a date, a start time and an end time.' } as const;
    // An end time before the start time means it runs past midnight.
    if (ends_at <= starts_at) ends_at = new Date(new Date(ends_at).getTime() + 86400000).toISOString();
    if (!['public', 'group', 'hidden'].includes(visibility)) return { error: 'Pick who can see it.' } as const;
    if (visibility === 'group' && !groupId) return { error: 'Pick a group, or let everyone see it.' } as const;
    const capacity = capacityRaw ? Number(capacityRaw) : null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return { error: 'Seats must be a whole number.' } as const;

    const names = all(fd, 'role_name');
    const maxes = all(fd, 'role_max');
    const ids = all(fd, 'role_id');
    const roles: RoleInput[] = [];
    const seen = new Set<string>();
    names.forEach((name, i) => {
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const max = maxes[i] ? Number(maxes[i]) : null;
        roles.push({
            id: ids[i] ?? '',
            role_name: name.slice(0, 40),
            max_count: max && Number.isInteger(max) && max > 0 ? max : null,
            position: roles.length,
        });
    });

    return {
        row: {
            title,
            description_md: field(fd, 'description_md') || null,
            group_id: groupId,
            starts_at,
            ends_at,
            location: field(fd, 'location') || null,
            visibility,
            capacity,
        },
        roles,
        date,
    } as const;
}

export async function createEvent(fd: FormData) {
    const supabase = await db();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?next=/events/new');

    const r = readEvent(fd);
    const g = field(fd, 'group_id');
    const retry = `/events/new${g ? `?group=${g}` : ''}`;
    if ('error' in r) back(retry, 'error', r.error!);

    const base = `${slugify(r.row.title) || 'game-day'}-${r.date}`;
    let slug = base;
    for (let attempt = 0; ; attempt++) {
        const { error } = await supabase.from('events').insert({ ...r.row, slug, created_by: user.id });
        if (!error) break;
        if (error.code === '23505' && attempt < 5) {
            slug = `${base}-${attempt + 2}`;
            continue;
        }
        back(retry, 'error', error.code === '42501' ? 'You can only plan game days for groups you belong to.' : error.message);
    }

    const { data: ev } = await supabase.from('events').select('id').eq('slug', slug).single();
    if (ev && r.roles.length) {
        const { error } = await supabase
            .from('event_roles')
            .insert(r.roles.map(({ role_name, max_count, position }) => ({ event_id: ev.id, role_name, max_count, position })));
        if (error) back(`/events/${slug}`, 'error', `Game day saved, but the roles didn't: ${error.message}`);
    }
    refresh(slug);
    redirect(`/events/${slug}?notice=${encodeURIComponent('Game day posted.')}`);
}

export async function updateEvent(fd: FormData) {
    const supabase = await db();
    const id = field(fd, 'event_id');
    const slug = field(fd, 'slug');
    const r = readEvent(fd);
    if ('error' in r) back(`/events/${slug}/edit`, 'error', r.error!);

    const { error, count } = await supabase.from('events').update(r.row, { count: 'exact' }).eq('id', id);
    if (error || !count) back(`/events/${slug}/edit`, 'error', error?.message ?? 'Only the organizer can edit this game day.');

    // Roles: update kept ones in place (RSVPs point at them), add new, drop removed.
    const { data: existing } = await supabase.from('event_roles').select('id').eq('event_id', id);
    const keep = new Set(r.roles.filter((x) => x.id).map((x) => x.id));
    const drop = (existing ?? []).map((x) => x.id).filter((x) => !keep.has(x));
    if (drop.length) await supabase.from('event_roles').delete().in('id', drop);
    for (const role of r.roles) {
        const { error: roleErr } = role.id
            ? await supabase
                  .from('event_roles')
                  .update({ role_name: role.role_name, max_count: role.max_count, position: role.position })
                  .eq('id', role.id)
            : await supabase
                  .from('event_roles')
                  .insert({ event_id: id, role_name: role.role_name, max_count: role.max_count, position: role.position });
        if (roleErr) back(`/events/${slug}/edit`, 'error', roleErr.message);
    }
    refresh(slug);
    back(`/events/${slug}`, 'notice', 'Changes saved. People who are going have been told.');
}

export async function rsvp(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?next=/events/${slug}`);
    const status = field(fd, 'status');
    const { data, error } = await supabase.rpc('rsvp', {
        p_event: field(fd, 'event_id'),
        p_status: status,
        p_role: field(fd, 'role_id') || null,
        p_note: field(fd, 'note') || null,
    });
    if (error) back(`/events/${slug}`, 'error', error.message);
    refresh(slug);
    const message =
        data === 'waitlist'
            ? "It's full, so you're on the waitlist. You'll be notified if a seat opens."
            : data === 'yes'
              ? "You're going."
              : data === 'maybe'
                ? 'Marked as maybe.'
                : "Got it, you can't make it.";
    back(`/events/${slug}`, 'notice', message);
}

export async function inviteToEvent(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const username = field(fd, 'username');
    if (!username) back(`/events/${slug}`, 'error', 'Enter a username to invite.');
    const { error } = await supabase.rpc('invite_to_event', { p_event: field(fd, 'event_id'), p_username: username });
    if (error) back(`/events/${slug}`, 'error', error.message);
    refresh(slug);
    back(`/events/${slug}`, 'notice', `Invited ${username.replace(/^@/, '')}.`);
}

export async function uninvite(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('uninvite_from_event', {
        p_event: field(fd, 'event_id'),
        p_user: field(fd, 'user_id'),
    });
    if (error) back(`/events/${slug}`, 'error', error.message);
    refresh(slug);
    back(`/events/${slug}`, 'notice', 'Invite removed.');
}

export async function cancelEvent(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('cancel_event', { p_event: field(fd, 'event_id') });
    if (error) back(`/events/${slug}`, 'error', error.message);
    refresh(slug);
    back(`/events/${slug}`, 'notice', 'Game day cancelled. Everyone who replied has been told.');
}

export async function restoreEvent(fd: FormData) {
    const supabase = await db();
    const slug = field(fd, 'slug');
    const { error } = await supabase.rpc('restore_event', { p_event: field(fd, 'event_id') });
    if (error) back(`/events/${slug}`, 'error', error.message);
    refresh(slug);
    back(`/events/${slug}`, 'notice', 'Game day is back on.');
}

// ---- Calendar feed ---------------------------------------------------------

function toSettings(kind: 'notice' | 'error', message: string): never {
    redirect(`/profile/settings?${kind}=${encodeURIComponent(message)}#calendar`);
}

export async function rotateFeed() {
    const supabase = await db();
    const { error } = await supabase.rpc('rotate_calendar_feed');
    revalidatePath('/profile/settings');
    toSettings(error ? 'error' : 'notice', error ? error.message : 'Calendar link ready. Any older link stops working.');
}

export async function deleteFeed() {
    const supabase = await db();
    await supabase.rpc('delete_calendar_feed');
    revalidatePath('/profile/settings');
    toSettings('notice', 'Calendar link turned off.');
}

// ---- Group role templates --------------------------------------------------

export async function saveRoleTemplates(fd: FormData) {
    const supabase = await db();
    const groupId = field(fd, 'group_id');
    const slug = field(fd, 'slug');
    const names = all(fd, 'role_name');
    const maxes = all(fd, 'role_max');
    const rows = names
        .map((n, i) => ({ n, m: maxes[i] ? Number(maxes[i]) : null }))
        .filter((x) => x.n)
        .map((x, i) => ({
            group_id: groupId,
            role_name: x.n.slice(0, 40),
            default_max: x.m && Number.isInteger(x.m) && x.m > 0 ? x.m : null,
            position: i,
        }));
    const { error: delErr } = await supabase.from('group_role_templates').delete().eq('group_id', groupId);
    if (delErr) back(`/groups/${slug}/manage`, 'error', delErr.message);
    if (rows.length) {
        const { error } = await supabase.from('group_role_templates').insert(rows);
        if (error) back(`/groups/${slug}/manage`, 'error', error.message);
    }
    revalidatePath(`/groups/${slug}/manage`);
    back(`/groups/${slug}/manage`, 'notice', 'Default roles saved.');
}
