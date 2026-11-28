import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Badge, EmptyState, PageHead, buttonClasses } from '@cfo/ui';
import { PenSquare } from 'lucide-react';
import type { NewsPost } from '@cfo/database/types';
import { getCurrentUser } from '@/lib/auth';
import { fmtNewsDate, getNewsCategories, listNewsForAdmin } from '@/lib/news';
import { Notice, first } from '@/app/groups/_components/Notice';

export const metadata: Metadata = { title: 'News posts' };

const GROUPS: { status: NewsPost['status']; title: string }[] = [
    { status: 'draft', title: 'Drafts' },
    { status: 'published', title: 'Published' },
    { status: 'archived', title: 'Archived' },
];

export default async function NewsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();
    const [sp, posts, categories] = await Promise.all([searchParams, listNewsForAdmin(), getNewsCategories()]);
    const catName = new Map(categories.map((c) => [c.id, c.name]));

    return (
        <>
            <PageHead
                kicker={<Link href="/news" className="no-underline hover:underline">News</Link>}
                title="News posts"
                lede="Drafts are only visible to admins. Archived posts drop off the feed but keep their votes."
                actions={
                    <Link href="/news/admin/new" className={buttonClasses('primary')}>
                        <PenSquare size={16} /> Write a post
                    </Link>
                }
            />
            <Notice notice={first(sp.notice)} error={first(sp.error)} />
            <div className="grid gap-12 py-10">
                {posts.length === 0 ? (
                    <EmptyState
                        title="No posts yet"
                        body="Write the first one. It can stay a draft until it's ready."
                        action={<Link href="/news/admin/new" className={buttonClasses('primary')}>Write a post</Link>}
                    />
                ) : (
                    GROUPS.map((g) => {
                        const rows = posts.filter((p) => p.status === g.status);
                        if (rows.length === 0) return null;
                        return (
                            <section key={g.status} aria-labelledby={`${g.status}-h`}>
                                <h2 id={`${g.status}-h`} className="mb-3 text-[2rem] font-extrabold">
                                    {g.title} <span className="cfo-num text-graphite-soft">{rows.length}</span>
                                </h2>
                                <ul className="border-t border-graphite/15">
                                    {rows.map((p) => (
                                        <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-graphite/15 py-4">
                                            <div className="min-w-0">
                                                <Link href={`/news/admin/${p.id}/edit`} className="font-display text-[1.4rem] font-bold leading-tight text-graphite no-underline decoration-gold underline-offset-4 [font-stretch:72%] hover:underline">
                                                    {p.title}
                                                </Link>
                                                <div className="cfo-ui mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite-soft">
                                                    {p.category_id && catName.get(p.category_id) ? <Badge>{catName.get(p.category_id)}</Badge> : null}
                                                    <span>
                                                        {p.status === 'published' ? `Published ${fmtNewsDate(p.published_at)}` : `Last saved ${fmtNewsDate(p.updated_at)}`}
                                                    </span>
                                                    {p.status !== 'draft' ? <span className="cfo-num">{p.upvotes} up, {p.downvotes} down</span> : null}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Link href={`/news/${p.slug}`} className={buttonClasses('ghost', 'sm')}>View</Link>
                                                <Link href={`/news/admin/${p.id}/edit`} className={buttonClasses('outline', 'sm')}>Edit</Link>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                    })
                )}
            </div>
        </>
    );
}
