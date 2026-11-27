import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { stripLeadingTitle } from '@/lib/markdown';
import { MarkdownRender, PageHead } from '@cfo/ui';
import { getArchivePageBySlug } from '@/lib/archive';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const page = await getArchivePageBySlug(slug);
    if (!page) return { title: 'Page not found' };
    return { title: page.title };
}

export default async function ArchivePagePage({ params }: PageProps) {
    const { slug } = await params;
    const page = await getArchivePageBySlug(slug);
    if (!page) notFound();

    return (
        <>
            <PageHead
                kicker={
                    <span className="flex flex-wrap gap-x-2">
                        <Link href="/archive" className="no-underline hover:underline">
                            Archive
                        </Link>
                        <span aria-hidden="true">/</span>
                        <span className="capitalize">{page.category ? page.category.replace(/-/g, ' ') : 'Reference'}</span>
                    </span>
                }
                title={page.title}
            />
            <article className="py-12">
                <MarkdownRender source={stripLeadingTitle(page.body_md, page.title)} />
            </article>
        </>
    );
}
