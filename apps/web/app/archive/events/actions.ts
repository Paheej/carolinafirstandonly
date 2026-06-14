'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import { isAdminEmail } from '@cfo/shared';
import type { EventFormValues } from './_components/EventForm';

export interface EventActionResult {
    ok: boolean;
    error?: string;
}

async function assertAdmin() {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { supabase, error: 'Not signed in.' as const };
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
    const admin = profile?.is_admin || isAdminEmail(user.email ?? '');
    if (!admin) return { supabase, error: 'Not authorized.' as const };
    return { supabase, error: null };
}

function rowFromValues(v: EventFormValues) {
    return {
        slug: v.slug.trim(),
        name: v.name.trim(),
        event_date: v.event_date || null,
        game_system: v.game_system || null,
        game_edition: v.game_edition || null,
        season_id: v.season_id || null,
        hero_image_url: v.hero_image_url.trim() || null,
        description_md: v.description_md.trim() || null,
    };
}

export async function createEvent(values: EventFormValues): Promise<EventActionResult> {
    if (values.name.trim().length < 2) return { ok: false, error: 'Name is required.' };
    if (!/^[a-z0-9-]+$/.test(values.slug)) {
        return { ok: false, error: 'Slug must be lowercase letters, numbers, and dashes.' };
    }

    const { supabase, error: authErr } = await assertAdmin();
    if (authErr) return { ok: false, error: authErr };

    const { data: rows } = await supabase
        .from('archive_events')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
    const nextOrder = (rows?.[0]?.display_order ?? 0) + 1;

    const { error } = await supabase
        .from('archive_events')
        .insert({ ...rowFromValues(values), display_order: nextOrder });
    if (error) return { ok: false, error: error.message };

    revalidatePath('/archive');
    redirect(`/archive/events/${values.slug.trim()}`);
}

export async function updateEvent(
    currentSlug: string,
    values: EventFormValues,
): Promise<EventActionResult> {
    if (values.name.trim().length < 2) return { ok: false, error: 'Name is required.' };

    const { supabase, error: authErr } = await assertAdmin();
    if (authErr) return { ok: false, error: authErr };

    // Slug is locked on edit (form disables the field); enforce that here too
    // so a tampered client can't rename a published URL out from under us.
    const row = { ...rowFromValues(values), slug: currentSlug };

    const { error } = await supabase
        .from('archive_events')
        .update(row)
        .eq('slug', currentSlug);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/archive');
    revalidatePath(`/archive/events/${currentSlug}`);
    redirect(`/archive/events/${currentSlug}`);
}
