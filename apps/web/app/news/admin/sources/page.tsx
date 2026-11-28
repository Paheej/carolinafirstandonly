import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHead, buttonClasses } from '@cfo/ui';
import { Rss, Youtube, Globe } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getNewsCategories } from '@/lib/news';
import { fmtWhen, listSources } from '@/lib/agent/admin';
import { Notice, first } from '@/app/groups/_components/Notice';
import { toggleSource } from '../drafts/actions';

export const metadata: Metadata = { title: 'News agent sources' };

const KIND = {
    rss: { label: 'RSS feed', Icon: Rss },
    youtube: { label: 'YouTube channel', Icon: Youtube },
    web_scrape: { label: 'Web page', Icon: Globe },
} as const;

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();
    const [sp, sources, categories] = await Promise.all([searchParams, listSources(), getNewsCategories()]);
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const on = sources.filter((s) => s.enabled).length;

    return (
        <>
            <PageHead
                kicker={<Link href="/news/admin/drafts" className="no-underline hover:underline">Drafts from the news agent</Link>}
                title="Sources"
                lede={`The agent reads ${on} of these ${sources.length} every morning, at most a few new items from each. YouTube drafts come from each video’s title and description only, since YouTube doesn’t share other channels’ captions.`}
            />
            <Notice notice={first(sp.notice)} error={first(sp.error)} />
            <ul className="my-10 border-t border-graphite/15">
                {sources.map((s) => {
                    const { label, Icon } = KIND[s.source_type];
                    return (
                        <li key={s.id} className={`grid gap-x-6 gap-y-2 border-b border-graphite/15 py-4 sm:grid-cols-[1fr_auto] sm:items-center ${s.enabled ? '' : 'opacity-70'}`}>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <Icon size={16} className="shrink-0 text-gold-deep" aria-label={label} />
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-display text-[1.3rem] font-bold leading-tight text-graphite no-underline [font-stretch:72%] hover:underline">
                                        {s.name}
                                    </a>
                                </div>
                                <p className="cfo-ui mt-1 text-sm text-graphite-soft">
                                    {label}
                                    {s.default_category_id && catName.get(s.default_category_id) ? `, usually ${catName.get(s.default_category_id)}` : ''}
                                    {s.last_run_at ? `. Last read ${fmtWhen(s.last_run_at)}, ${s.last_item_count ?? 0} new` : '. Not read yet'}
                                </p>
                                {s.last_error ? <p className="cfo-ui mt-1 text-sm text-casualty">Last problem: {s.last_error}</p> : null}
                                {s.notes ? <p className="mt-1 text-sm text-graphite-soft">{s.notes}</p> : null}
                            </div>
                            <form action={toggleSource}>
                                <input type="hidden" name="id" value={s.id} />
                                <input type="hidden" name="enabled" value={s.enabled ? 'false' : 'true'} />
                                <button type="submit" className={buttonClasses(s.enabled ? 'ghost' : 'outline', 'sm')}>
                                    {s.enabled ? 'Switch off' : 'Switch on'}
                                </button>
                            </form>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
