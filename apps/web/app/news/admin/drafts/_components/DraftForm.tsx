'use client';

import * as React from 'react';
import { Button, Card, CardBody, Input, Label, MarkdownEditor, Textarea } from '@cfo/ui';
import type { NewsCategory } from '@cfo/database/types';
import type { DraftFormValues } from '../actions';

type Result = { ok: boolean; error?: string };

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

export function DraftForm({
    initial,
    categories,
    onPublish,
    onSave,
    onDiscard,
}: {
    initial: Omit<DraftFormValues, 'slug'>;
    categories: NewsCategory[];
    onPublish: (v: DraftFormValues) => Promise<Result>;
    onSave: (v: DraftFormValues) => Promise<Result>;
    onDiscard: () => Promise<Result>;
}) {
    const [values, setValues] = React.useState<DraftFormValues>({ ...initial, slug: slugify(initial.title) });
    const [slugTouched, setSlugTouched] = React.useState(false);
    const [busy, setBusy] = React.useState<'publish' | 'save' | 'discard' | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const set = <K extends keyof DraftFormValues>(k: K, v: DraftFormValues[K]) => setValues((cur) => ({ ...cur, [k]: v }));

    async function go(kind: 'publish' | 'save' | 'discard') {
        setError(null);
        setBusy(kind);
        try {
            const r = kind === 'publish' ? await onPublish(values) : kind === 'save' ? await onSave(values) : await onDiscard();
            if (!r.ok) setError(r.error ?? 'That didn’t work.');
        } catch (err) {
            if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return;
            setError(err instanceof Error ? err.message : 'That didn’t work.');
        } finally {
            setBusy(null);
        }
    }

    return (
        <form
            className="space-y-5"
            onSubmit={(e) => {
                e.preventDefault();
                void go('publish');
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
                                maxLength={160}
                                required
                                onChange={(e) => setValues((cur) => ({ ...cur, title: e.target.value, slug: slugTouched ? cur.slug : slugify(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="slug" required>Slug</Label>
                            <Input
                                id="slug"
                                value={values.slug}
                                pattern="[a-z0-9-]+"
                                required
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    set('slug', e.target.value);
                                }}
                            />
                            <p className="mt-1 text-xs text-graphite-soft">The post’s address: /news/{values.slug || '…'}</p>
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
                        <Label htmlFor="excerpt">Summary</Label>
                        <Textarea id="excerpt" rows={2} maxLength={400} value={values.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
                        <p className="mt-1 text-xs text-graphite-soft">Shown on the feed.</p>
                    </div>
                    <div>
                        <Label required>Post</Label>
                        <MarkdownEditor value={values.body_md} onChange={(v) => set('body_md', v)} minHeight={320} />
                        <p className="mt-1 text-xs text-graphite-soft">Check the facts against the original before publishing. The agent can get details wrong.</p>
                    </div>
                </CardBody>
            </Card>

            {error ? (
                <p role="alert" className="cfo-ui rounded-[3px] border border-casualty/50 bg-casualty/10 px-4 py-3 text-sm text-casualty">{error}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="primary" disabled={busy !== null}>{busy === 'publish' ? 'Publishing…' : 'Publish'}</Button>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => go('save')}>{busy === 'save' ? 'Saving…' : 'Save draft'}</Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => go('discard')}>{busy === 'discard' ? 'Discarding…' : 'Discard'}</Button>
            </div>
        </form>
    );
}
