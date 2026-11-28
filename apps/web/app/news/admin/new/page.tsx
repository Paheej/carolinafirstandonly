import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHead } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getNewsCategories } from '@/lib/news';
import { PostForm } from '../_components/PostForm';
import { createPost } from '../actions';

export const metadata: Metadata = { title: 'Write a post' };

export default async function NewNewsPostPage() {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();
    const categories = await getNewsCategories();

    return (
        <>
            <PageHead
                kicker={<Link href="/news/admin" className="no-underline hover:underline">News posts</Link>}
                title="Write a post"
                lede="Publish it now, or save a draft that only admins can see."
            />
            <div className="py-10">
                <PostForm mode="create" categories={categories} onSubmit={createPost} />
            </div>
        </>
    );
}
