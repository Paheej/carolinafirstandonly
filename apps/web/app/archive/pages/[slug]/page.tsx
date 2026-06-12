import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardBody, Badge, MarkdownRender } from '@cfo/ui';
import { ArrowLeft } from 'lucide-react';
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
        <article className="space-y-10">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>

            <header className="space-y-4">
                {page.category ? (
                    <Badge variant="forest">{page.category.replace(/-/g, ' ')}</Badge>
                ) : null}
                <h1 className="cfo-heading-underline font-display text-4xl sm:text-5xl text-ink">
                    {page.title}
                </h1>
            </header>

            <Card>
                <CardBody className="px-7 py-7">
                    <MarkdownRender source={page.body_md} />
                </CardBody>
            </Card>
        </article>
    );
}
