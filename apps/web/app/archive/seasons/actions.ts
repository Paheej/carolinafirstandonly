'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import { isAdminEmail } from '@cfo/shared';
import type { SeasonFormValues } from './_components/SeasonForm';

export interface SeasonActionResult {
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

function rowFromValues(v: SeasonFormValues) {
    const slug = v.slug.trim();
    const name = v.name.trim();
    return {
        slug,
        name,
        year: v.year ? Number(v.year) : null,
        starts_on: v.starts_on || null,
        ends_on: v.ends_on || null,
        game_system: v.game_system || null,
        game_edition: v.game_edition || null,
        hero_image_url: v.hero_image_url.trim() || null,
        description_md: v.description_md.trim() || null,
    };
}

export async function createSeason(values: SeasonFormValues): Promise<SeasonActionResult> {
    if (values.name.trim().length < 2) return { ok: false, error: 'Name is required.' };
    if (!/^[a-z0-9-]+$/.test(values.slug)) {
        return { ok: false, error: 'Slug must be lowercase letters, numbers, and dashes.' };
    }

    const { supabase, error: authErr } = await assertAdmin();
    if (authErr) return { ok: false, error: authErr };

    // Place at the end of the list by default.
    const { data: rows } = await supabase
        .from('seasons')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
    const nextOrder = (rows?.[0]?.display_order ?? 0) + 1;

    const { error } = await supabase
        .from('seasons')
        .insert({ ...rowFromValues(values), display_order: nextOrder });
    if (error) return { ok: false, error: error.message };

    revalidatePath('/archive');
    redirect(`/archive/seasons/${values.slug.trim()}`);
}

export async function updateSeason(
    currentSlug: string,
    values: SeasonFormValues,
): Promise<SeasonActionResult> {
    if (values.name.trim().length < 2) return { ok: false, error: 'Name is required.' };
    if (!/^[a-z0-9-]+$/.test(values.slug)) {
        return { ok: false, error: 'Slug must be lowercase letters, numbers, and dashes.' };
    }

    const { supabase, error: authErr } = await assertAdmin();
    if (authErr) return { ok: false, error: authErr };

    const { error } = await supabase
        .from('seasons')
        .update(rowFromValues(values))
        .eq('slug', currentSlug);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/archive');
    revalidatePath(`/archive/seasons/${currentSlug}`);
    if (values.slug !== currentSlug) revalidatePath(`/archive/seasons/${values.slug}`);
    redirect(`/archive/seasons/${values.slug.trim()}`);
}
