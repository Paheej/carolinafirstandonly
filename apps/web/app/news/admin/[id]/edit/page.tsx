import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHead } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getNewsCategories, getNewsPostById } from '@/lib/news';
import { PostForm } from '../../_components/PostForm';
import { updatePost } from '../../actions';

export const metadata: Metadata = { title: 'Edit post' };

export default async function EditNewsPostPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();
    const { id } = await params;
    const [post, categories] = await Promise.all([getNewsPostById(id), getNewsCategories()]);
    if (!post) notFound();

    return (
        <>
            <PageHead
                kicker={<Link href="/news/admin" className="no-underline hover:underline">News posts</Link>}
                title="Edit post"
                lede={post.status === 'published' ? 'This post is live. Saving changes updates it right away.' : 'Only admins can see this post until you publish it.'}
            />
            <div className="py-10">
                <PostForm
                    mode="edit"
                    categories={categories}
                    initial={{
                        title: post.title,
                        slug: post.slug,
                        category_id: post.category_id ?? '',
                        tags: post.tags.join(', '),
                        excerpt: post.excerpt ?? '',
                        source_url: post.source_url ?? '',
                        body_md: post.body_md,
                        status: post.status,
                    }}
                    onSubmit={updatePost.bind(null, post.id)}
                />
            </div>
        </>
    );
}
