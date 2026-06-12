'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import type { RecapPhoto } from '@cfo/database/types';

interface ActionContext {
    submissionId: string;
}

async function ensureAdmin() {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { supabase: null as never, error: 'Sign in required' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
    if (!profile?.is_admin) {
        return { supabase: null as never, error: 'Admin only' };
    }
    return { supabase, userId: user.id, error: null as string | null };
}

export interface ReviewResult {
    ok: boolean;
    error?: string;
}

export async function approveSubmission(
    ctx: ActionContext,
): Promise<ReviewResult> {
    const { supabase, userId, error } = await ensureAdmin();
    if (error) return { ok: false, error };

    const { error: updateError } = await supabase
        .from('recap_submissions')
        .update({ status: 'approved', reviewed_by: userId })
        .eq('id', ctx.submissionId);
    if (updateError) return { ok: false, error: updateError.message };

    revalidatePath('/archive/pending');
    revalidatePath('/archive');
    return { ok: true };
}

export async function rejectSubmission(
    ctx: ActionContext & { notes: string },
): Promise<ReviewResult> {
    if (!ctx.notes.trim()) {
        return { ok: false, error: 'A reason is required when rejecting.' };
    }
    const { supabase, userId, error } = await ensureAdmin();
    if (error) return { ok: false, error };

    const { error: updateError } = await supabase
        .from('recap_submissions')
        .update({
            status: 'rejected',
            reviewed_by: userId,
            review_notes: ctx.notes.trim(),
        })
        .eq('id', ctx.submissionId);
    if (updateError) return { ok: false, error: updateError.message };

    revalidatePath('/archive/pending');
    return { ok: true };
}

export interface EditSubmissionInput extends ActionContext {
    title: string;
    body_md: string;
    photos: RecapPhoto[];
}

export async function editSubmission(
    input: EditSubmissionInput,
): Promise<ReviewResult> {
    const { supabase, error } = await ensureAdmin();
    if (error) return { ok: false, error };

    const { error: updateError } = await supabase
        .from('recap_submissions')
        .update({
            title: input.title.trim(),
            body_md: input.body_md,
            photos: input.photos,
        })
        .eq('id', input.submissionId);
    if (updateError) return { ok: false, error: updateError.message };

    revalidatePath('/archive/pending');
    return { ok: true };
}
