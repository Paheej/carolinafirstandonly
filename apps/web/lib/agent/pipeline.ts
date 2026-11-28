import { createServiceSupabase } from '@cfo/database/server';
import type { AgentSource, Json } from '@cfo/database/types';
import { AGENT_MODEL, draftItem, hasApiKey, type Usage } from './claude';
import { configOf, fetchSource, loadContent, type SourceItem } from './fetchers';

/** CLAUDE.md -> AI Agent -> cost guardrails. */
export const MAX_DRAFTS_PER_RUN = 15;
/** Claude calls per run, including items it turns down. */
const MAX_CALLS_PER_RUN = 30;
const DEFAULT_ITEMS_PER_SOURCE = 5;
/** How far back a source's first run looks, and the longest any run looks back. */
const FIRST_RUN_DAYS = 3;
const MAX_LOOKBACK_DAYS = 7;
const CONCURRENCY = 4;

export function monthlyBudgetUsd(): number {
    const v = Number(process.env.AGENT_MONTHLY_BUDGET_USD);
    return Number.isFinite(v) && v > 0 ? v : 20;
}

export interface RunSummary {
    runId: string | null;
    status: 'ok' | 'partial' | 'failed' | 'over_budget' | 'busy' | 'no_key';
    itemsFound: number;
    draftsCreated: number;
    itemsSkipped: number;
    costUsd: number;
    errors: { source?: string; url?: string; message: string }[];
}

type Candidate = SourceItem & { source: AgentSource };

const DAY = 86_400_000;

/** Run the whole pipeline once. Safe to call from the cron and from the admin button. */
export async function runAgent(opts: { trigger: 'cron' | 'manual'; userId?: string | null }): Promise<RunSummary> {
    const db = createServiceSupabase();
    const empty = (status: RunSummary['status'], message?: string): RunSummary => ({
        runId: null, status, itemsFound: 0, draftsCreated: 0, itemsSkipped: 0, costUsd: 0, errors: message ? [{ message }] : [],
    });
    if (!hasApiKey()) return empty('no_key', 'ANTHROPIC_API_KEY is not set.');

    // One run at a time. A run stuck in "running" for over 10 minutes was killed by the platform.
    const { data: busy } = await db
        .from('agent_runs')
        .select('id')
        .eq('status', 'running')
        .gte('started_at', new Date(Date.now() - 10 * 60_000).toISOString())
        .limit(1);
    if (busy?.length) return empty('busy', 'Another run is still going.');
    await db.from('agent_runs').update({ status: 'failed', finished_at: new Date().toISOString(), errors: [{ message: 'Timed out.' }] }).eq('status', 'running');

    const budget = monthlyBudgetUsd();
    const { data: spentRaw } = await db.rpc('agent_month_cost');
    const spentBefore = Number(spentRaw ?? 0);

    const { data: run, error: runErr } = await db
        .from('agent_runs')
        .insert({ trigger: opts.trigger, triggered_by: opts.userId ?? null, model: AGENT_MODEL })
        .select('id')
        .single();
    if (runErr || !run) return empty('failed', runErr?.message ?? 'Could not start a run.');

    const summary: RunSummary = { ...empty('ok'), runId: run.id };
    let inputTokens = 0;
    let outputTokens = 0;
    let overBudget = spentBefore >= budget;

    try {
        if (!overBudget) {
            const candidates = await collect(db, summary);
            summary.itemsFound = candidates.length;

            let calls = 0;
            const queue = [...candidates];
            const worker = async () => {
                for (let c = queue.shift(); c; c = queue.shift()) {
                    if (summary.draftsCreated >= MAX_DRAFTS_PER_RUN || calls >= MAX_CALLS_PER_RUN) return;
                    if (spentBefore + summary.costUsd >= budget) {
                        overBudget = true;
                        return;
                    }
                    calls++;
                    try {
                        const item = await loadContent(c);
                        const result = await draftItem(item, c.source.name);
                        track(result.usage);
                        if (result.kind === 'declined') {
                            await markSeen(db, c, result.reason);
                            summary.itemsSkipped++;
                            continue;
                        }
                        const d = result.draft;
                        if (!d.is_relevant || d.newsworthiness < 2 || !d.title || !d.body_md) {
                            await markSeen(db, c, d.is_relevant ? `newsworthiness ${d.newsworthiness}` : 'not relevant');
                            summary.itemsSkipped++;
                            continue;
                        }
                        if (summary.draftsCreated >= MAX_DRAFTS_PER_RUN) return;
                        const { error } = await db.from('agent_drafts').insert({
                            source_id: c.source.id,
                            source_url: c.url,
                            source_title: item.title || null,
                            source_published_at: item.publishedAt,
                            raw_excerpt: item.content.slice(0, 4000) || null,
                            draft_title: d.title,
                            draft_body_md: d.body_md,
                            draft_excerpt: d.excerpt || null,
                            suggested_category_id: (await categoryId(db, d.suggested_category)) ?? c.source.default_category_id,
                            suggested_tags: [...new Set([...c.source.default_tags, ...d.suggested_tags])].slice(0, 8),
                            newsworthiness: d.newsworthiness,
                        });
                        if (error && !/duplicate key/.test(error.message)) throw new Error(error.message);
                        if (!error) summary.draftsCreated++;
                    } catch (err) {
                        summary.errors.push({ source: c.source.name, url: c.url, message: errMessage(err) });
                    }
                }
            };
            await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        }
    } catch (err) {
        summary.errors.push({ message: errMessage(err) });
        summary.status = 'failed';
    }

    function track(u: Usage) {
        inputTokens += u.inputTokens;
        outputTokens += u.outputTokens;
        summary.costUsd += u.costUsd;
    }

    if (summary.status !== 'failed') {
        summary.status = overBudget ? 'over_budget' : summary.errors.length ? 'partial' : 'ok';
    }
    await db
        .from('agent_runs')
        .update({
            status: summary.status as 'ok' | 'partial' | 'failed' | 'over_budget',
            finished_at: new Date().toISOString(),
            items_found: summary.itemsFound,
            drafts_created: summary.draftsCreated,
            items_skipped: summary.itemsSkipped,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: Number(summary.costUsd.toFixed(4)),
            errors: summary.errors.slice(0, 50) as unknown as Json,
        })
        .eq('id', run.id);
    await db.from('audit_log').insert({
        actor_id: opts.userId ?? null,
        action: 'agent_run',
        target_table: 'agent_runs',
        target_id: run.id,
        metadata: { trigger: opts.trigger, status: summary.status, drafts: summary.draftsCreated, cost_usd: summary.costUsd, model: AGENT_MODEL },
    });

    if (summary.draftsCreated > 0) {
        const n = summary.draftsCreated;
        await db.rpc('notify_admins', {
            p_kind: 'agent_drafts',
            p_title: `${n} new news ${n === 1 ? 'draft' : 'drafts'} to review`,
            p_body: 'The news agent drafted these from the sources it follows.',
            p_link: '/news/admin/drafts',
        });
    }
    if (overBudget) await notifyOverBudget(db, run.id, spentBefore + summary.costUsd, budget);
    console.log('[news-agent]', JSON.stringify({ ...summary, errors: summary.errors.length }));
    return summary;
}

type Db = ReturnType<typeof createServiceSupabase>;

/** New items from every enabled source, newest first, already deduped. */
async function collect(db: Db, summary: RunSummary): Promise<Candidate[]> {
    const { data: sources } = await db.from('agent_sources').select('*').eq('enabled', true).order('name');
    const now = Date.now();
    const perSource = await Promise.all(
        (sources ?? []).map(async (source) => {
            const since = source.last_run_at
                ? Math.max(new Date(source.last_run_at).getTime() - DAY, now - MAX_LOOKBACK_DAYS * DAY)
                : now - FIRST_RUN_DAYS * DAY;
            try {
                const items = await fetchSource(source);
                const recent = items.filter((i) => !i.publishedAt || new Date(i.publishedAt).getTime() >= since);
                const fresh = await unseen(db, recent.map((i) => i.url));
                const max = configOf(source).max_items ?? DEFAULT_ITEMS_PER_SOURCE;
                const picked = recent.filter((i) => fresh.has(i.url)).slice(0, max);
                await db.from('agent_sources').update({ last_run_at: new Date().toISOString(), last_error: null, last_item_count: picked.length }).eq('id', source.id);
                return picked.map((i) => ({ ...i, source }));
            } catch (err) {
                const message = errMessage(err);
                summary.errors.push({ source: source.name, message });
                await db.from('agent_sources').update({ last_error: message.slice(0, 500) }).eq('id', source.id);
                return [];
            }
        }),
    );
    // Newest first, so the 15-draft cap drops the oldest. Undated items (scraped indexes) go last.
    return perSource.flat().sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

/** The URLs that have neither a draft nor a "seen and skipped" mark. */
async function unseen(db: Db, urls: string[]): Promise<Set<string>> {
    const unique = [...new Set(urls)];
    if (!unique.length) return new Set();
    const [drafts, seen] = await Promise.all([
        db.from('agent_drafts').select('source_url').in('source_url', unique),
        db.from('agent_seen_urls').select('url').in('url', unique),
    ]);
    const known = new Set([...(drafts.data ?? []).map((r) => r.source_url), ...(seen.data ?? []).map((r) => r.url)]);
    return new Set(unique.filter((u) => !known.has(u)));
}

async function markSeen(db: Db, c: Candidate, reason: string) {
    await db.from('agent_seen_urls').upsert({ url: c.url, source_id: c.source.id, reason }, { onConflict: 'url' });
}

const categoryCache = new Map<string, string | null>();
async function categoryId(db: Db, slug: string): Promise<string | null> {
    if (!categoryCache.has(slug)) {
        const { data } = await db.from('news_categories').select('id').eq('slug', slug).maybeSingle();
        categoryCache.set(slug, data?.id ?? null);
    }
    return categoryCache.get(slug) ?? null;
}

async function notifyOverBudget(db: Db, runId: string, spent: number, budget: number) {
    // Tell the admins once a month, not every day.
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: earlier } = await db
        .from('agent_runs')
        .select('id')
        .eq('status', 'over_budget')
        .neq('id', runId)
        .gte('started_at', monthStart.toISOString())
        .limit(1);
    if (earlier?.length) return;
    await db.rpc('notify_admins', {
        p_kind: 'agent_budget',
        p_title: 'The news agent paused for the month',
        p_body: `It has spent $${spent.toFixed(2)} of its $${budget.toFixed(0)} monthly budget, so it stops until the 1st. Raise AGENT_MONTHLY_BUDGET_USD to keep it going.`,
        p_link: '/news/admin/drafts',
    });
}

function errMessage(err: unknown): string {
    return (err instanceof Error ? err.message : String(err)).slice(0, 300);
}
