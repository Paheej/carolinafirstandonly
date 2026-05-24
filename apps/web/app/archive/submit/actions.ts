'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@cfo/database/server';
import type { RecapPhoto } from '@cfo/database/types';

export interface SubmitRecapInput {
    title: string;
    body_md: string;
    photos: RecapPhoto[];
    targetKind: 'season' | 'event';
    targetId: string;
}

export interface SubmitRecapResult {
    ok: boolean;
    error?: string;
}

export async function submitRecap(input: SubmitRecapInput): Promise<SubmitRecapResult> {
    const title = input.title.trim();
    const body = input.body_md.trim();
    if (title.length < 3) return { ok: false, error: 'Title is too short.' };
    if (body.length < 20) return { ok: false, error: 'Body is too short — give it some shape.' };
    if (!input.targetId) return { ok: false, error: 'Pick a season or event to attach to.' };
    if (input.photos.length > 10) return { ok: false, error: 'Max 10 photos.' };

    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Sign in to submit.' };

    const insert = {
        author_id: user.id,
        title,
        body_md: body,
        photos: input.photos,
        season_id: input.targetKind === 'season' ? input.targetId : null,
        archive_event_id: input.targetKind === 'event' ? input.targetId : null,
    } as const;

    const { error } = await supabase.from('recap_submissions').insert(insert);
    if (error) return { ok: false, error: error.message };

    redirect('/archive/submit/thanks');
}
