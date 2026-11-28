import { cookies } from 'next/headers';
import { createServerSupabase, createServiceSupabase } from '@cfo/database/server';
import type { AgentDraft, AgentRun, AgentSource } from '@cfo/database/types';
import { monthlyBudgetUsd } from './pipeline';

/** Reads for /news/admin/drafts and /news/admin/sources. RLS limits all of it to admins. */

export type DraftSort = 'best' | 'new' | 'source';
export function parseDraftSort(v: string | undefined): DraftSort {
    return v === 'new' || v === 'source' ? v : 'best';
}

export type DraftWithSource = AgentDraft & { source_name: string | null };

export async function listDrafts(sort: DraftSort): Promise<DraftWithSource[]> {
    const supabase = createServerSupabase(await cookies());
    const [{ data: drafts }, { data: sources }] = await Promise.all([
        supabase.from('agent_drafts').select('*').eq('status', 'draft').order('created_at', { ascending: false }).limit(200),
        supabase.from('agent_sources').select('id, name'),
    ]);
    const name = new Map((sources ?? []).map((s) => [s.id, s.name]));
    const rows = (drafts ?? []).map((d) => ({ ...d, source_name: d.source_id ? name.get(d.source_id) ?? null : null }));
    const when = (d: AgentDraft) => d.source_published_at ?? d.created_at;
    if (sort === 'best') rows.sort((a, b) => (b.newsworthiness ?? 0) - (a.newsworthiness ?? 0) || when(b).localeCompare(when(a)));
    if (sort === 'new') rows.sort((a, b) => when(b).localeCompare(when(a)));
    if (sort === 'source') rows.sort((a, b) => (a.source_name ?? '').localeCompare(b.source_name ?? '') || when(b).localeCompare(when(a)));
    return rows;
}

export async function listRecentlyReviewed(limit = 8): Promise<DraftWithSource[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('agent_drafts')
        .select('*')
        .neq('status', 'draft')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })
        .limit(limit);
    return (data ?? []).map((d) => ({ ...d, source_name: null }));
}

export async function getDraft(id: string): Promise<DraftWithSource | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.from('agent_drafts').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    let source_name: string | null = null;
    if (data.source_id) {
        const { data: s } = await supabase.from('agent_sources').select('name').eq('id', data.source_id).maybeSingle();
        source_name = s?.name ?? null;
    }
    return { ...data, source_name };
}

export async function listSources(): Promise<AgentSource[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.from('agent_sources').select('*').order('enabled', { ascending: false }).order('name');
    return data ?? [];
}

export async function listRuns(limit = 10): Promise<AgentRun[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(limit);
    return data ?? [];
}

export async function countAgentDrafts(): Promise<number> {
    const supabase = createServerSupabase(await cookies());
    const { count } = await supabase.from('agent_drafts').select('id', { count: 'exact', head: true }).eq('status', 'draft');
    return count ?? 0;
}

/** This month's spend against the budget, and whether the agent can run at all. */
export async function agentStatus(): Promise<{ spent: number; budget: number; hasKey: boolean }> {
    let spent = 0;
    try {
        const { data } = await createServiceSupabase().rpc('agent_month_cost');
        spent = Number(data ?? 0);
    } catch {
        /* no service key locally: show $0 */
    }
    return { spent, budget: monthlyBudgetUsd(), hasKey: Boolean(process.env.ANTHROPIC_API_KEY) };
}

export function fmtUsd(n: number): string {
    return n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`;
}

export function fmtWhen(iso: string | null): string | null {
    return iso
        ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
        : null;
}
