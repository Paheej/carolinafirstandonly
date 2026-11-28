import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Badge, EmptyState, PageHead, buttonClasses } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getNewsCategories } from '@/lib/news';
import { agentStatus, fmtUsd, fmtWhen, listDrafts, listRecentlyReviewed, listRuns, parseDraftSort, type DraftSort } from '@/lib/agent/admin';
import { Notice, first } from '@/app/groups/_components/Notice';
import { Worth } from './_components/Worth';
import { RunButton } from './_components/RunButton';
import { discardFromList, runAgentNow } from './actions';

export const metadata: Metadata = { title: 'News drafts' };
// "Run the agent now" runs the whole pipeline inside this page's server action.
export const maxDuration = 300;

const SORTS: { key: DraftSort; label: string }[] = [
    { key: 'best', label: 'Most newsworthy' },
    { key: 'new', label: 'Newest' },
    { key: 'source', label: 'By source' },
];

const RUN_STATUS: Record<string, string> = {
    running: 'Running',
    ok: 'Finished',
    partial: 'Finished with problems',
    failed: 'Failed',
    over_budget: 'Stopped at the budget',
};

export default async function DraftsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();
    const sp = await searchParams;
    const sort = parseDraftSort(first(sp.sort));
    const [drafts, reviewed, runs, categories, status] = await Promise.all([
        listDrafts(sort),
        listRecentlyReviewed(),
        listRuns(8),
        getNewsCategories(),
        agentStatus(),
    ]);
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const lastRun = runs[0];

    return (
        <>
            <PageHead
                kicker={<Link href="/news/admin" className="no-underline hover:underline">News posts</Link>}
                title="Drafts from the news agent"
                lede={
                    <>
                        Every morning at 6 the agent reads the sites and channels it follows and drafts a short item for anything worth sharing. Nothing goes live
                        until an admin publishes it. This month it has spent {fmtUsd(status.spent)} of its {fmtUsd(status.budget)} budget.
                    </>
                }
                actions={
                    <div className="flex flex-wrap gap-2">
                        <RunButton action={runAgentNow} disabled={!status.hasKey} />
                        <Link href="/news/admin/sources" className={buttonClasses('outline')}>Sources</Link>
                    </div>
                }
            />
            <Notice notice={first(sp.notice)} error={first(sp.error)} />
            {!status.hasKey ? (
                <p className="cfo-ui mt-6 rounded-[3px] border border-gold/50 bg-gold/10 px-4 py-3 text-graphite">
                    The agent is waiting for an Anthropic API key. Until <code>ANTHROPIC_API_KEY</code> is set, it won’t run.
                </p>
            ) : null}

            <div className="grid gap-12 py-10">
                <section aria-labelledby="queue-h">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
                        <h2 id="queue-h" className="text-[2rem] font-extrabold">
                            Waiting for review <span className="cfo-num text-graphite-soft">{drafts.length}</span>
                        </h2>
                        <nav aria-label="Sort drafts" className="cfo-ui flex gap-1 text-sm">
                            {SORTS.map((s) => (
                                <Link
                                    key={s.key}
                                    href={s.key === 'best' ? '/news/admin/drafts' : `/news/admin/drafts?sort=${s.key}`}
                                    aria-current={sort === s.key ? 'page' : undefined}
                                    className={`rounded-[3px] px-3 py-1.5 no-underline ${sort === s.key ? 'bg-mat text-on-mat' : 'text-graphite-soft hover:text-graphite'}`}
                                >
                                    {s.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    {drafts.length === 0 ? (
                        <EmptyState
                            title="Nothing to review"
                            body={lastRun ? `The last run was ${fmtWhen(lastRun.started_at)}. New drafts show up here after the next one.` : 'The agent hasn’t run yet. Run it now, or wait for 6 am.'}
                        />
                    ) : (
                        <ul className="border-t border-graphite/15">
                            {drafts.map((d) => (
                                <li key={d.id} className="grid gap-x-5 gap-y-2 border-b border-graphite/15 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                                    <Worth value={d.newsworthiness ?? 1} />
                                    <div className="min-w-0">
                                        <Link
                                            href={`/news/admin/drafts/${d.id}`}
                                            className="font-display text-[1.4rem] font-bold leading-tight text-graphite no-underline decoration-gold underline-offset-4 [font-stretch:72%] hover:underline"
                                        >
                                            {d.draft_title}
                                        </Link>
                                        {d.draft_excerpt ? <p className="mt-1 max-w-[70ch] text-graphite-soft">{d.draft_excerpt}</p> : null}
                                        <div className="cfo-ui mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite-soft">
                                            {d.suggested_category_id && catName.get(d.suggested_category_id) ? <Badge>{catName.get(d.suggested_category_id)}</Badge> : null}
                                            <span>From {d.source_name ?? 'a removed source'}</span>
                                            <span>{fmtWhen(d.source_published_at ?? d.created_at)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 sm:justify-end">
                                        <Link href={`/news/admin/drafts/${d.id}`} className={buttonClasses('outline', 'sm')}>Review</Link>
                                        <form action={discardFromList}>
                                            <input type="hidden" name="id" value={d.id} />
                                            <button type="submit" className={buttonClasses('ghost', 'sm')}>Discard</button>
                                        </form>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section aria-labelledby="runs-h">
                    <h2 id="runs-h" className="mb-3 text-[2rem] font-extrabold">Recent runs</h2>
                    {runs.length === 0 ? (
                        <p className="text-graphite-soft">No runs yet.</p>
                    ) : (
                        <ul className="border-t border-graphite/15">
                            {runs.map((r) => {
                                const errors = Array.isArray(r.errors) ? (r.errors as { source?: string; message?: string }[]) : [];
                                return (
                                    <li key={r.id} className="border-b border-graphite/15 py-3">
                                        <div className="cfo-ui flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                            <span className="font-semibold text-graphite">{fmtWhen(r.started_at)}</span>
                                            <span className={r.status === 'failed' ? 'text-casualty' : 'text-graphite-soft'}>
                                                {RUN_STATUS[r.status] ?? r.status}
                                                {r.trigger === 'manual' ? ', started by hand' : ''}
                                            </span>
                                            <span className="cfo-num text-graphite-soft">
                                                {r.drafts_created} drafted, {r.items_skipped} passed over, {fmtUsd(Number(r.cost_usd))}
                                            </span>
                                        </div>
                                        {errors.length ? (
                                            <details className="mt-1 text-sm text-graphite-soft">
                                                <summary className="cfo-ui cursor-pointer">{errors.length} {errors.length === 1 ? 'problem' : 'problems'}</summary>
                                                <ul className="mt-1 list-disc pl-5">
                                                    {errors.slice(0, 12).map((e, i) => (
                                                        <li key={i}>{e.source ? `${e.source}: ` : ''}{e.message}</li>
                                                    ))}
                                                </ul>
                                            </details>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {reviewed.length ? (
                    <section aria-labelledby="reviewed-h">
                        <h2 id="reviewed-h" className="mb-3 text-[2rem] font-extrabold">Recently reviewed</h2>
                        <ul className="border-t border-graphite/15">
                            {reviewed.map((d) => (
                                <li key={d.id} className="cfo-ui flex flex-wrap items-baseline justify-between gap-x-4 border-b border-graphite/15 py-3">
                                    <span className={d.status === 'discarded' ? 'text-graphite-soft line-through decoration-graphite/30' : 'text-graphite'}>{d.draft_title}</span>
                                    <span className="text-sm text-graphite-soft">{d.status === 'published' ? 'Published' : 'Discarded'} {fmtWhen(d.reviewed_at)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}
            </div>
        </>
    );
}

