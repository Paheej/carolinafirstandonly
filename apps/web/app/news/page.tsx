import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, EmptyState, PageHead, buttonClasses } from '@cfo/ui';
import { ExternalLink, PenSquare, X } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { excerpt } from '@/lib/markdown';
import { fmtNewsDate, getMyVotes, getNewsCategories, listNews, parseSort, sourceHost, type NewsSort } from '@/lib/news';
import { first } from '@/app/groups/_components/Notice';
import { VoteControl } from './_components/VoteControl';

export const metadata: Metadata = {
    title: 'News',
    description: 'Hobby news, tactics, painting and lore, voted up by the club.',
};

const SORTS: { key: NewsSort; label: string }[] = [
    { key: 'hot', label: 'Hot' },
    { key: 'top', label: 'Top' },
    { key: 'new', label: 'New' },
];

export default async function NewsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [sp, user, categories] = await Promise.all([searchParams, getCurrentUser(), getNewsCategories()]);
    const sort = parseSort(first(sp.sort));
    const category = categories.find((c) => c.slug === first(sp.category)) ?? null;
    const tag = first(sp.tag)?.trim().toLowerCase() || null;
    const { posts, nextCursor } = await listNews({ sort, categoryId: category?.id, tag, cursor: first(sp.cursor) });
    const myVotes = await getMyVotes(posts.map((p) => p.id));
    const catById = new Map(categories.map((c) => [c.id, c]));
    const isAdmin = user?.profile?.is_admin ?? false;

    const href = (o: { sort?: NewsSort; category?: string | null; tag?: string | null; cursor?: string | null }) => {
        const q = new URLSearchParams();
        const s = o.sort ?? sort;
        if (s !== 'hot') q.set('sort', s);
        const c = o.category === undefined ? category?.slug : o.category;
        if (c) q.set('category', c);
        const t = o.tag === undefined ? tag : o.tag;
        if (t) q.set('tag', t);
        if (o.cursor) q.set('cursor', o.cursor);
        const qs = q.toString();
        return qs ? `/news?${qs}` : '/news';
    };
    const tab = (on: boolean) =>
        `cfo-ui border-b-2 px-1 pb-1.5 font-semibold no-underline ${on ? 'border-gold text-graphite' : 'border-transparent text-graphite-soft hover:text-graphite'}`;
    const chip = (on: boolean) =>
        `cfo-ui rounded-[3px] border px-2.5 py-1 text-sm font-semibold no-underline ${
            on ? 'border-mat bg-mat text-on-mat' : 'border-graphite/20 text-graphite-soft hover:border-gold hover:text-graphite'
        }`;

    return (
        <>
            <PageHead
                kicker="News"
                title="From the hobby"
                lede="Releases, rules, tactics and painting news picked for the club. Vote on what's worth reading. You don't need an account."
                actions={
                    isAdmin ? (
                        <>
                            <Link href="/news/admin" className={buttonClasses('outline')}>
                                All posts
                            </Link>
                            <Link href="/news/admin/new" className={buttonClasses('primary')}>
                                <PenSquare size={16} /> Write a post
                            </Link>
                        </>
                    ) : null
                }
            />

            <div className="py-10">
                <div className="mb-8 grid gap-5">
                    <nav aria-label="Sort" className="flex gap-6 border-b border-graphite/15">
                        {SORTS.map((s) => (
                            <Link key={s.key} href={href({ sort: s.key, cursor: null })} className={tab(sort === s.key)} aria-current={sort === s.key ? 'page' : undefined}>
                                {s.label}
                            </Link>
                        ))}
                    </nav>
                    <nav aria-label="Category" className="flex flex-wrap gap-2">
                        <Link href={href({ category: null })} className={chip(!category)} aria-current={!category ? 'page' : undefined}>
                            Everything
                        </Link>
                        {categories.map((c) => (
                            <Link key={c.id} href={href({ category: c.slug })} className={chip(category?.id === c.id)} aria-current={category?.id === c.id ? 'page' : undefined}>
                                {c.name}
                            </Link>
                        ))}
                        {tag ? (
                            <Link href={href({ tag: null })} className={`${chip(true)} inline-flex items-center gap-1`} aria-label={`Remove the tag filter ${tag}`}>
                                Tagged {tag} <X size={14} aria-hidden="true" />
                            </Link>
                        ) : null}
                    </nav>
                </div>

                {posts.length === 0 ? (
                    <EmptyState
                        title={category || tag ? 'Nothing here yet' : 'No news yet'}
                        body={
                            category || tag
                                ? 'No posts match this filter. Try another category, or see everything.'
                                : 'Posts will show up here once they’re published.'
                        }
                        action={
                            category || tag ? (
                                <Link href="/news" className={buttonClasses('outline')}>See everything</Link>
                            ) : isAdmin ? (
                                <Link href="/news/admin/new" className={buttonClasses('primary')}>Write the first post</Link>
                            ) : null
                        }
                    />
                ) : (
                    <ol className="border-t border-graphite/15">
                        {posts.map((p) => {
                            const cat = p.category_id ? catById.get(p.category_id) : null;
                            const host = sourceHost(p.source_url);
                            const blurb = p.excerpt || excerpt(p.body_md, 220);
                            return (
                                <li key={p.id} className="flex gap-4 border-b border-graphite/15 py-5 sm:gap-6">
                                    <VoteControl postId={p.id} title={p.title} upvotes={p.upvotes} downvotes={p.downvotes} myVote={myVotes[p.id] ?? 0} />
                                    <article className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            {cat ? (
                                                <Link href={href({ category: cat.slug, cursor: null })} className="no-underline">
                                                    <Badge variant="gold">{cat.name}</Badge>
                                                </Link>
                                            ) : null}
                                            <span className="cfo-ui cfo-num text-sm font-semibold text-graphite-soft">{fmtNewsDate(p.published_at)}</span>
                                        </div>
                                        <h2 className="mt-1.5 font-display text-[1.6rem] font-bold leading-tight [font-stretch:72%]">
                                            <Link href={`/news/${p.slug}`} className="text-graphite no-underline decoration-gold underline-offset-4 hover:underline">
                                                {p.title}
                                            </Link>
                                        </h2>
                                        {blurb ? <p className="mt-1 max-w-[68ch] text-base text-graphite-soft">{blurb}</p> : null}
                                        {host || p.tags.length > 0 ? (
                                            <div className="cfo-ui mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                                {host ? (
                                                    <a href={p.source_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-deep">
                                                        via {host} <ExternalLink size={13} aria-hidden="true" />
                                                    </a>
                                                ) : null}
                                                {p.tags.map((t) => (
                                                    <Link key={t} href={href({ tag: t, cursor: null })} className="text-graphite-soft hover:text-graphite">
                                                        #{t}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : null}
                                    </article>
                                </li>
                            );
                        })}
                    </ol>
                )}

                {nextCursor || first(sp.cursor) ? (
                    <nav aria-label="Pages" className="mt-8 flex gap-3">
                        {first(sp.cursor) ? (
                            <Link href={href({ cursor: null })} className={buttonClasses('outline')}>Back to the top</Link>
                        ) : null}
                        {nextCursor ? (
                            <Link href={href({ cursor: nextCursor })} className={buttonClasses('secondary')}>More posts</Link>
                        ) : null}
                    </nav>
                ) : null}
            </div>
        </>
    );
}
