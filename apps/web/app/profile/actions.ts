'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import { encryptSecret, normalizeCalendarLink, providerName, syncConnection } from '@/lib/calendar-sync';

function back(kind: 'notice' | 'error', message: string): never {
    redirect(`/profile/settings?${kind}=${encodeURIComponent(message)}`);
}

export async function updateProfile(fd: FormData) {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?next=/profile/settings');

    const str = (k: string) => {
        const v = fd.get(k);
        return typeof v === 'string' ? v.trim() : '';
    };
    // Saved as typed ("Paheej"); invites, lookups and uniqueness ignore case.
    const username = str('username').replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
        back('error', 'Usernames are 3 to 30 characters: letters, numbers and underscores, no spaces.');
    }
    const { error } = await supabase
        .from('profiles')
        .update({
            username,
            display_name: str('display_name') || null,
            bio: str('bio') || null,
            preferred_systems: fd.getAll('systems').filter((v): v is string => typeof v === 'string'),
        })
        .eq('id', user.id);
    if (error) back('error', error.code === '23505' ? `@${username} is taken. Try another.` : error.message);
    revalidatePath('/', 'layout');
    back('notice', 'Profile saved.');
}

// ---------------------------------------------------------------------------
// Calendar connections (busy times for planning)
// ---------------------------------------------------------------------------
function backCal(kind: 'notice' | 'error', message: string): never {
    redirect(`/profile/settings?${kind}=${encodeURIComponent(message)}#busy`);
}

async function signedIn() {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?next=/profile/settings');
    return { supabase, user };
}

export async function connectCalendar(fd: FormData) {
    const { supabase, user } = await signedIn();
    const raw = fd.get('link');
    const link = normalizeCalendarLink(typeof raw === 'string' ? raw : '');
    if ('error' in link) backCal('error', link.error);
    const labelIn = fd.get('label');
    const label = (typeof labelIn === 'string' && labelIn.trim().slice(0, 60)) || providerName('ics', link.url.hostname);

    const { data, error } = await supabase
        .from('calendar_connections')
        .insert({ user_id: user.id, label, account: link.url.hostname, encrypted_secret: encryptSecret(link.url.toString()) })
        .select('id, provider, encrypted_secret')
        .single();
    if (error || !data) backCal('error', error?.message ?? 'Could not save that calendar.');
    const res = await syncConnection(data);
    revalidatePath('/profile/settings');
    if (!res.ok) backCal('error', `Saved, but the first sync failed: ${res.error}`);
    backCal('notice', `Connected. Found ${res.blocks} busy ${res.blocks === 1 ? 'stretch' : 'stretches'} in the next 90 days.`);
}

export async function syncCalendarNow(fd: FormData) {
    const { supabase } = await signedIn();
    const id = fd.get('id');
    // RLS: only finds your own connection.
    const { data } = await supabase
        .from('calendar_connections')
        .select('id, provider, encrypted_secret')
        .eq('id', typeof id === 'string' ? id : '')
        .maybeSingle();
    if (!data) backCal('error', 'Calendar not found.');
    const res = await syncConnection(data);
    revalidatePath('/profile/settings');
    if (!res.ok) backCal('error', res.error);
    backCal('notice', `Synced. ${res.blocks} busy ${res.blocks === 1 ? 'stretch' : 'stretches'} in the next 90 days.`);
}

export async function toggleCalendar(fd: FormData) {
    const { supabase } = await signedIn();
    const id = fd.get('id');
    const enabled = fd.get('enabled') === 'true';
    const { error } = await supabase.from('calendar_connections').update({ enabled }).eq('id', typeof id === 'string' ? id : '');
    if (error) backCal('error', error.message);
    revalidatePath('/profile/settings');
    backCal('notice', enabled ? 'Calendar turned back on.' : 'Paused. Planners won’t see this calendar’s busy times.');
}

export async function disconnectCalendar(fd: FormData) {
    const { supabase } = await signedIn();
    const id = fd.get('id');
    const { error } = await supabase.from('calendar_connections').delete().eq('id', typeof id === 'string' ? id : '');
    if (error) backCal('error', error.message);
    revalidatePath('/profile/settings');
    backCal('notice', 'Disconnected. Its link and busy times are deleted.');
}
