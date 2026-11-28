'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import type { PostFormValues } from './_components/PostForm';

export interface PostActionResult {
    ok: boolean;
    error?: string;
}

async function adminClient() {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { supabase, uid: null, error: 'Sign in first.' };
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return { supabase, uid: null, error: 'Only admins can write news.' };
    return { supabase, uid: user.id, error: null };
}

function validate(v: PostFormValues): string | null {
    if (v.title.trim().length < 2) return 'Add a title.';
    if (!/^[a-z0-9-]+$/.test(v.slug.trim())) return 'The slug can only use lowercase letters, numbers and dashes.';
    if (!v.body_md.trim()) return 'Write the post before saving.';
    if (v.source_url.trim() && !/^https?:\/\/\S+$/.test(v.source_url.trim())) return 'The source link must start with http:// or https://.';
    if (v.excerpt.trim().length > 400) return 'Keep the summary under 400 characters.';
    return null;
}

function rowFrom(v: PostFormValues) {
    const tags = [...new Set(v.tags.split(',').map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 12);
    return {
        title: v.title.trim(),
        body_md: v.body_md.trim(),
        excerpt: v.excerpt.trim() || null,
        category_id: v.category_id || null,
        tags,
        source_url: v.source_url.trim() || null,
        status: v.status,
    };
}

function friendly(message: string) {
    return /news_posts_slug_key|duplicate key/.test(message) ? 'Another post already uses that slug. Pick a different one.' : message;
}

export async function createPost(values: PostFormValues): Promise<PostActionResult> {
    const invalid = validate(values);
    if (invalid) return { ok: false, error: invalid };
    const { supabase, uid, error: authErr } = await adminClient();
    if (authErr) return { ok: false, error: authErr };

    const slug = values.slug.trim();
    const { error } = await supabase.from('news_posts').insert({ ...rowFrom(values), slug, author_id: uid });
    if (error) return { ok: false, error: friendly(error.message) };

    revalidatePath('/news');
    redirect(values.status === 'published' ? `/news/${slug}` : '/news/admin?notice=Draft+saved.');
}

export async function updatePost(id: string, values: PostFormValues): Promise<PostActionResult> {
    const invalid = validate(values);
    if (invalid) return { ok: false, error: invalid };
    const { supabase, error: authErr } = await adminClient();
    if (authErr) return { ok: false, error: authErr };

    // The slug stays fixed once a post exists, so links keep working.
    const { data, error } = await supabase.from('news_posts').update(rowFrom(values)).eq('id', id).select('slug').maybeSingle();
    if (error) return { ok: false, error: friendly(error.message) };
    if (!data) return { ok: false, error: 'That post no longer exists.' };

    revalidatePath('/news');
    revalidatePath(`/news/${data.slug}`);
    redirect(values.status === 'published' ? `/news/${data.slug}` : '/news/admin?notice=Saved.');
}
