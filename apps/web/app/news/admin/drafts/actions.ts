'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import { runAgent } from '@/lib/agent/pipeline';

async function requireAdmin() {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { supabase, uid: null as string | null, error: 'Sign in first.' };
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return { supabase, uid: null, error: 'Only admins can review drafts.' };
    return { supabase, uid: user.id, error: null };
}

export interface DraftFormValues {
    title: string;
    slug: string;
    category_id: string;
    tags: string;
    excerpt: string;
    body_md: string;
}

function tagsOf(s: string): string[] {
    return [...new Set(s.split(',').map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 12);
}

function validate(v: DraftFormValues, publishing: boolean): string | null {
    if (v.title.trim().length < 2) return 'Add a title.';
    if (!v.body_md.trim()) return 'The post is empty.';
    if (v.excerpt.trim().length > 400) return 'Keep the summary under 400 characters.';
    if (publishing && !/^[a-z0-9-]+$/.test(v.slug.trim())) return 'The slug can only use lowercase letters, numbers and dashes.';
    return null;
}

export async function saveDraft(id: string, v: DraftFormValues): Promise<{ ok: boolean; error?: string }> {
    const invalid = validate(v, false);
    if (invalid) return { ok: false, error: invalid };
    const { supabase, error: authErr } = await requireAdmin();
    if (authErr) return { ok: false, error: authErr };
    const { data, error } = await supabase
        .from('agent_drafts')
        .update({
            draft_title: v.title.trim(),
            draft_body_md: v.body_md.trim(),
            draft_excerpt: v.excerpt.trim() || null,
            suggested_category_id: v.category_id || null,
            suggested_tags: tagsOf(v.tags),
        })
        .eq('id', id)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'That draft was already published or discarded.' };
    revalidatePath('/news/admin/drafts');
    redirect('/news/admin/drafts?notice=Draft+saved.');
}

export async function publishDraft(id: string, v: DraftFormValues): Promise<{ ok: boolean; error?: string }> {
    const invalid = validate(v, true);
    if (invalid) return { ok: false, error: invalid };
    const { supabase, error: authErr } = await requireAdmin();
    if (authErr) return { ok: false, error: authErr };
    const { data: slug, error } = await supabase.rpc('publish_agent_draft', {
        p_draft: id,
        p_slug: v.slug.trim(),
        p_title: v.title.trim(),
        p_body_md: v.body_md.trim(),
        p_excerpt: v.excerpt.trim() || null,
        p_category: v.category_id || null,
        p_tags: tagsOf(v.tags),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/news');
    revalidatePath('/');
    revalidatePath('/news/admin/drafts');
    redirect(`/news/${slug}`);
}

export async function discardDraft(id: string): Promise<{ ok: boolean; error?: string }> {
    const { supabase, uid, error: authErr } = await requireAdmin();
    if (authErr) return { ok: false, error: authErr };
    const { error } = await supabase
        .from('agent_drafts')
        .update({ status: 'discarded', reviewed_by: uid, reviewed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'draft');
    if (error) return { ok: false, error: error.message };
    revalidatePath('/news/admin/drafts');
    redirect('/news/admin/drafts?notice=Discarded.');
}

/** "Discard" straight from the list. */
export async function discardFromList(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    const r = await discardDraft(id);
    if (!r.ok) redirect(`/news/admin/drafts?error=${encodeURIComponent(r.error ?? 'Not discarded.')}`);
}

export async function runAgentNow() {
    const { uid, error } = await requireAdmin();
    if (error || !uid) redirect(`/news/admin/drafts?error=${encodeURIComponent(error ?? 'Sign in first.')}`);
    const r = await runAgent({ trigger: 'manual', userId: uid });
    revalidatePath('/news/admin/drafts');
    const msg =
        r.status === 'no_key' ? 'The agent needs an Anthropic API key (ANTHROPIC_API_KEY) before it can run.'
        : r.status === 'busy' ? 'A run is already going. Check back in a few minutes.'
        : r.status === 'over_budget' && r.draftsCreated === 0 ? 'The agent has used this month’s budget, so it didn’t run.'
        : r.status === 'failed' ? `The run failed: ${r.errors[0]?.message ?? 'unknown error'}`
        : `Run finished: ${r.draftsCreated} new ${r.draftsCreated === 1 ? 'draft' : 'drafts'} from ${r.itemsFound} new ${r.itemsFound === 1 ? 'item' : 'items'}${r.errors.length ? `, ${r.errors.length} ${r.errors.length === 1 ? 'problem' : 'problems'} (see Recent runs)` : ''}.`;
    const bad = r.status === 'no_key' || r.status === 'failed' || r.status === 'busy';
    redirect(`/news/admin/drafts?${bad ? 'error' : 'notice'}=${encodeURIComponent(msg)}`);
}

export async function toggleSource(formData: FormData) {
    const { supabase, error } = await requireAdmin();
    if (error) redirect(`/news/admin/sources?error=${encodeURIComponent(error)}`);
    const id = String(formData.get('id') ?? '');
    const enabled = formData.get('enabled') === 'true';
    const { error: upErr } = await supabase.from('agent_sources').update({ enabled }).eq('id', id);
    if (upErr) {
        const msg = /check constraint/.test(upErr.message) ? 'That YouTube source needs a channel ID before it can be switched on.' : upErr.message;
        redirect(`/news/admin/sources?error=${encodeURIComponent(msg)}`);
    }
    revalidatePath('/news/admin/sources');
    redirect(`/news/admin/sources?notice=${enabled ? 'Switched+on.' : 'Switched+off.'}`);
}
