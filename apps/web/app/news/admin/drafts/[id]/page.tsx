import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHead } from '@cfo/ui';
import { ExternalLink } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getNewsCategories, sourceHost } from '@/lib/news';
import { fmtWhen, getDraft } from '@/lib/agent/admin';
import { DraftForm } from '../_components/DraftForm';
import { Worth } from '../_components/Worth';
import { discardDraft, publishDraft, saveDraft } from '../actions';

export const metadata: Metadata = { title: 'Review draft' };

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();
    const { id } = await params;
    const [draft, categories] = await Promise.all([getDraft(id), getNewsCategories()]);
    if (!draft) notFound();
    if (draft.status !== 'draft') {
        redirect(`/news/admin/drafts?notice=${encodeURIComponent(`That draft was already ${draft.status}.`)}`);
    }
    const isVideo = /youtube\.com\/watch/.test(draft.source_url);

    return (
        <>
            <PageHead
                kicker={<Link href="/news/admin/drafts" className="no-underline hover:underline">Drafts from the news agent</Link>}
                title="Review draft"
                lede="Edit it as much as you like. Publishing puts it on the news feed with a “via” link to the source."
            />
            <div className="grid gap-8 py-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
                <DraftForm
                    categories={categories}
                    initial={{
                        title: draft.draft_title,
                        category_id: draft.suggested_category_id ?? '',
                        tags: draft.suggested_tags.join(', '),
                        excerpt: draft.draft_excerpt ?? '',
                        body_md: draft.draft_body_md,
                    }}
                    onPublish={publishDraft.bind(null, draft.id)}
                    onSave={saveDraft.bind(null, draft.id)}
                    onDiscard={discardDraft.bind(null, draft.id)}
                />
                <aside aria-labelledby="source-h" className="space-y-4 rounded-[3px] bg-mat p-5 text-on-mat lg:sticky lg:top-6">
                    <h2 id="source-h" className="text-[1.6rem] font-extrabold text-on-mat">The source</h2>
                    <div className="space-y-1">
                        <p className="font-display text-[1.2rem] font-bold leading-snug [font-stretch:75%]">{draft.source_title ?? draft.source_url}</p>
                        <p className="cfo-ui text-sm text-on-mat-soft">
                            {draft.source_name ?? sourceHost(draft.source_url)}
                            {draft.source_published_at ? `, ${fmtWhen(draft.source_published_at)}` : ''}
                        </p>
                    </div>
                    <a href={draft.source_url} target="_blank" rel="noopener noreferrer" className="cfo-ui inline-flex items-center gap-1.5 text-gold-bright">
                        Open the original on {sourceHost(draft.source_url)} <ExternalLink size={14} aria-hidden />
                    </a>
                    <div className="cfo-ui flex items-center gap-3 text-sm text-on-mat-soft">
                        <Worth value={draft.newsworthiness ?? 1} />
                        <span>The agent’s guess at how much the club will care</span>
                    </div>
                    {isVideo ? (
                        <p className="text-sm text-on-mat-soft">
                            This is a video. The agent only read its title and description, because YouTube doesn’t share other channels’ captions. Watch it before publishing.
                        </p>
                    ) : null}
                    {draft.raw_excerpt ? (
                        <details className="text-sm">
                            <summary className="cfo-ui cursor-pointer text-on-mat">What the agent read</summary>
                            <div className="mt-2 max-h-[28rem] overflow-y-auto whitespace-pre-line border-l-2 border-gold pl-3 text-on-mat-soft">{draft.raw_excerpt}</div>
                        </details>
                    ) : null}
                </aside>
            </div>
        </>
    );
}
