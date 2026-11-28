import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Badge, MarkdownRender, PageHead, buttonClasses } from '@cfo/ui';
import { ExternalLink, Pencil } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { excerpt, firstImageUrl, sizedImage, stripLeadingTitle } from '@/lib/markdown';
import { fmtNewsDate, getAuthorName, getMyVotes, getNewsCategories, getNewsPostBySlug, sourceHost } from '@/lib/news';
import { VoteControl } from '../_components/VoteControl';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const post = await getNewsPostBySlug((await params).slug);
    if (!post) return { title: 'Post not found' };
    return { title: post.title, description: post.excerpt ?? excerpt(post.body_md, 160) ?? undefined };
}

export default async function NewsPostPage({ params }: PageProps) {
    const post = await getNewsPostBySlug((await params).slug);
    if (!post) notFound();
    const [user, categories, author, myVotes] = await Promise.all([
        getCurrentUser(),
        getNewsCategories(),
        getAuthorName(post.author_id),
        getMyVotes([post.id]),
    ]);
    const cat = categories.find((c) => c.id === post.category_id) ?? null;
    const host = sourceHost(post.source_url);
    const published = post.status === 'published';
    const image = firstImageUrl(post.body_md);
    const date = fmtNewsDate(post.published_at);

    return (
        <>
            <PageHead
                image={image ? sizedImage(image, 1600) : null}
                tone="light"
                kicker={
                    <span className="flex flex-wrap gap-x-2">
                        <Link href="/news" className="no-underline hover:underline">News</Link>
                        {cat ? (
                            <>
                                <span aria-hidden="true">/</span>
                                <Link href={`/news?category=${cat.slug}`} className="no-underline hover:underline">{cat.name}</Link>
                            </>
                        ) : null}
                    </span>
                }
                title={post.title}
                actions={
                    user?.profile?.is_admin ? (
                        <Link href={`/news/admin/${post.id}/edit`} className={buttonClasses('outline')}>
                            <Pencil size={16} /> Edit
                        </Link>
                    ) : null
                }
            >
                <p className={`cfo-ui mt-4 ${image ? 'text-on-mat-soft' : 'text-graphite-soft'}`}>
                    {published
                        ? [author ? `Posted by ${author}` : 'Posted', date ? `on ${date}` : null].filter(Boolean).join(' ') + '.'
                        : null}
                    {!published ? <Badge variant="danger">{post.status === 'draft' ? 'Draft' : 'Archived'}: only admins can see this</Badge> : null}
                </p>
            </PageHead>

            <article className="py-12">
                {host ? (
                    <p className="cfo-ui mb-8">
                        <a href={post.source_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-gold-deep">
                            Read the original on {host} <ExternalLink size={15} aria-hidden="true" />
                        </a>
                    </p>
                ) : null}
                <MarkdownRender source={stripLeadingTitle(post.body_md, post.title)} />

                <footer className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-graphite/15 pt-8">
                    {published ? (
                        <div className="flex items-center gap-4">
                            <VoteControl
                                layout="row"
                                postId={post.id}
                                title={post.title}
                                upvotes={post.upvotes}
                                downvotes={post.downvotes}
                                myVote={myVotes[post.id] ?? 0}
                            />
                            <span className="cfo-ui text-graphite-soft">Worth reading?</span>
                        </div>
                    ) : null}
                    {post.tags.length > 0 ? (
                        <ul className="cfo-ui flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Tags">
                            {post.tags.map((t) => (
                                <li key={t}>
                                    <Link href={`/news?tag=${encodeURIComponent(t)}`} className="text-graphite-soft hover:text-graphite">#{t}</Link>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </footer>
            </article>
        </>
    );
}
