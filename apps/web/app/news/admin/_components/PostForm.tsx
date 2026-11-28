'use client';

import * as React from 'react';
import { Button, Card, CardBody, Input, Label, MarkdownEditor, Textarea } from '@cfo/ui';
import type { NewsCategory } from '@cfo/database/types';

export interface PostFormValues {
    title: string;
    slug: string;
    category_id: string;
    tags: string;
    excerpt: string;
    source_url: string;
    body_md: string;
    status: 'draft' | 'published' | 'archived';
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .replace(/['"`’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

const selectClass =
    'h-10 w-full rounded-[3px] border border-graphite/15 bg-primer-lift/60 px-3 text-graphite focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

export function PostForm({
    mode,
    initial,
    categories,
    onSubmit,
}: {
    mode: 'create' | 'edit';
    initial?: Partial<PostFormValues>;
    categories: NewsCategory[];
    onSubmit: (values: PostFormValues) => Promise<{ ok: boolean; error?: string }>;
}) {
    const [values, setValues] = React.useState<PostFormValues>({
        title: '',
        slug: '',
        category_id: '',
        tags: '',
        excerpt: '',
        source_url: '',
        body_md: '',
        status: 'draft',
        ...initial,
    });
    const [slugTouched, setSlugTouched] = React.useState(mode === 'edit');
    const [submitting, setSubmitting] = React.useState<PostFormValues['status'] | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const set = <K extends keyof PostFormValues>(k: K, v: PostFormValues[K]) => setValues((cur) => ({ ...cur, [k]: v }));
    const wasPublished = initial?.status === 'published';

    async function save(status: PostFormValues['status']) {
        setError(null);
        setSubmitting(status);
        try {
            const r = await onSubmit({ ...values, status });
            if (!r.ok) setError(r.error ?? 'The post wasn’t saved.');
        } catch (err) {
            if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return;
            setError(err instanceof Error ? err.message : 'The post wasn’t saved.');
        } finally {
            setSubmitting(null);
        }
    }

    return (
        <form
            className="space-y-5"
            onSubmit={(e) => {
                e.preventDefault();
                void save('published');
            }}
        >
            <Card>
                <CardBody className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                        <div>
                            <Label htmlFor="title" required>Title</Label>
                            <Input
                                id="title"
                                value={values.title}
                                onChange={(e) =>
                                    setValues((cur) => ({ ...cur, title: e.target.value, slug: slugTouched ? cur.slug : slugify(e.target.value) }))
                                }
                                maxLength={160}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="slug" required>Slug</Label>
                            <Input
                                id="slug"
                                value={values.slug}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    set('slug', e.target.value);
                                }}
                                pattern="[a-z0-9-]+"
                                required
                                disabled={mode === 'edit'}
                                readOnly={mode === 'edit'}
                            />
                            <p className="mt-1 text-xs text-graphite-soft">
                                {mode === 'edit' ? 'The slug can’t change, so links to this post keep working.' : `The post’s address: /news/${values.slug || '…'}`}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="category">Category</Label>
                            <select id="category" value={values.category_id} onChange={(e) => set('category_id', e.target.value)} className={selectClass}>
                                <option value="">No category</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="tags">Tags</Label>
                            <Input id="tags" value={values.tags} onChange={(e) => set('tags', e.target.value)} placeholder="40k, kill team" />
                            <p className="mt-1 text-xs text-graphite-soft">Separate tags with commas.</p>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="source_url">Source link</Label>
                        <Input
                            id="source_url"
                            type="url"
                            value={values.source_url}
                            onChange={(e) => set('source_url', e.target.value)}
                            placeholder="https://www.warhammer-community.com/…"
                        />
                        <p className="mt-1 text-xs text-graphite-soft">The article this post is about, if there is one. It shows as “via” on the feed.</p>
                    </div>

                    <div>
                        <Label htmlFor="excerpt">Summary</Label>
                        <Textarea id="excerpt" rows={2} maxLength={400} value={values.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
                        <p className="mt-1 text-xs text-graphite-soft">Shown on the feed. Leave it empty to use the first paragraph.</p>
                    </div>

                    <div>
                        <Label required>Post</Label>
                        <MarkdownEditor value={values.body_md} onChange={(v) => set('body_md', v)} minHeight={360} />
                    </div>
                </CardBody>
            </Card>

            {error ? (
                <p role="alert" className="cfo-ui rounded-[3px] border border-casualty/50 bg-casualty/10 px-4 py-3 text-sm text-casualty">
                    {error}
                </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="primary" disabled={submitting !== null}>
                    {submitting === 'published' ? 'Saving…' : wasPublished ? 'Save changes' : 'Publish'}
                </Button>
                <Button type="button" variant="outline" disabled={submitting !== null} onClick={() => save('draft')}>
                    {submitting === 'draft' ? 'Saving…' : wasPublished ? 'Unpublish' : 'Save draft'}
                </Button>
                {mode === 'edit' && initial?.status !== 'archived' ? (
                    <Button type="button" variant="ghost" disabled={submitting !== null} onClick={() => save('archived')}>
                        {submitting === 'archived' ? 'Saving…' : 'Archive'}
                    </Button>
                ) : null}
            </div>
        </form>
    );
}
