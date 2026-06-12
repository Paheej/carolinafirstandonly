'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Input,
    Label,
    MarkdownEditor,
} from '@cfo/ui';
import { Send } from 'lucide-react';
import type { RecapPhoto } from '@cfo/database/types';
import { PhotoUploader } from '@/app/_components/PhotoUploader';
import { submitRecap } from './actions';

interface Target {
    id: string;
    slug: string;
    name: string;
}

export interface SubmitRecapFormProps {
    seasons: Target[];
    events: Target[];
}

export function SubmitRecapForm({ seasons, events }: SubmitRecapFormProps) {
    const router = useRouter();
    const [title, setTitle] = React.useState('');
    const [body, setBody] = React.useState('');
    const [photos, setPhotos] = React.useState<RecapPhoto[]>([]);
    const [targetKey, setTargetKey] = React.useState<string>('');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const [kind, id] = targetKey.split(':');
        if (kind !== 'season' && kind !== 'event') {
            setError('Pick a season or event.');
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitRecap({
                title,
                body_md: body,
                photos,
                targetKind: kind,
                targetId: id ?? '',
            });
            if (!result.ok) {
                setError(result.error ?? 'Submission failed.');
            } else {
                router.refresh();
            }
        } catch (err) {
            // Server actions throw on redirect — that's expected; only surface
            // real errors.
            if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
                return;
            }
            setError(err instanceof Error ? err.message : 'Submission failed.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <Card>
                <CardHeader>
                    <h2 className="font-display text-xl">Recap</h2>
                </CardHeader>
                <CardBody className="space-y-5">
                    <div>
                        <Label htmlFor="target" required>
                            Attach to
                        </Label>
                        <select
                            id="target"
                            value={targetKey}
                            onChange={(e) => setTargetKey(e.target.value)}
                            className="h-10 w-full rounded-sm border border-brass-dark/50 bg-parchment/60 px-3 text-ink focus-visible:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                            required
                        >
                            <option value="">Choose a season or event…</option>
                            {seasons.length > 0 ? (
                                <optgroup label="Seasons">
                                    {seasons.map((s) => (
                                        <option key={s.id} value={`season:${s.id}`}>
                                            {s.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ) : null}
                            {events.length > 0 ? (
                                <optgroup label="Special events">
                                    {events.map((e) => (
                                        <option key={e.id} value={`event:${e.id}`}>
                                            {e.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ) : null}
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="title" required>
                            Title
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Week 3 — Vault of the Mind Forge"
                            maxLength={140}
                            required
                        />
                    </div>

                    <div>
                        <Label required>Body (markdown)</Label>
                        <MarkdownEditor value={body} onChange={setBody} />
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <h2 className="font-display text-xl">Photos</h2>
                </CardHeader>
                <CardBody>
                    <PhotoUploader photos={photos} onChange={setPhotos} />
                </CardBody>
            </Card>

            {error ? (
                <div className="rounded-sm border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}

            <Card>
                <CardFooter className="flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-soft">
                        Submissions go through admin review before they appear on the public archive.
                    </p>
                    <Button type="submit" disabled={submitting}>
                        <Send size={14} />
                        {submitting ? 'Submitting…' : 'Send for review'}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
