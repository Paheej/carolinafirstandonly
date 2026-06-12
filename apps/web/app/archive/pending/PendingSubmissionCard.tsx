'use client';

import * as React from 'react';
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Input,
    Label,
    MarkdownEditor,
    MarkdownRender,
} from '@cfo/ui';
import { Check, X, Pencil, Eye } from 'lucide-react';
import type { RecapPhoto, RecapSubmission } from '@cfo/database/types';
import { PhotoUploader } from '@/app/_components/PhotoUploader';
import {
    approveSubmission,
    editSubmission,
    rejectSubmission,
} from './actions';

interface AuthorSummary {
    id: string;
    username: string;
    display_name: string | null;
}

export interface PendingSubmissionCardProps {
    submission: RecapSubmission;
    targetLabel: string;
    author: AuthorSummary | null;
}

type Mode = 'preview' | 'edit';

export function PendingSubmissionCard({
    submission,
    targetLabel,
    author,
}: PendingSubmissionCardProps) {
    const [mode, setMode] = React.useState<Mode>('preview');
    const [title, setTitle] = React.useState(submission.title);
    const [body, setBody] = React.useState(submission.body_md);
    const [photos, setPhotos] = React.useState<RecapPhoto[]>(submission.photos);
    const [busy, setBusy] = React.useState(false);
    const [notes, setNotes] = React.useState('');
    const [showRejectInput, setShowRejectInput] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function withBusy(fn: () => Promise<void>) {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } finally {
            setBusy(false);
        }
    }

    async function onSaveEdit() {
        await withBusy(async () => {
            const result = await editSubmission({
                submissionId: submission.id,
                title,
                body_md: body,
                photos,
            });
            if (!result.ok) setError(result.error ?? 'Could not save.');
            else setMode('preview');
        });
    }

    async function onApprove() {
        await withBusy(async () => {
            // If there are unsaved edits, save them first.
            if (
                title !== submission.title ||
                body !== submission.body_md ||
                JSON.stringify(photos) !== JSON.stringify(submission.photos)
            ) {
                const save = await editSubmission({
                    submissionId: submission.id,
                    title,
                    body_md: body,
                    photos,
                });
                if (!save.ok) {
                    setError(save.error ?? 'Could not save edits.');
                    return;
                }
            }
            const result = await approveSubmission({ submissionId: submission.id });
            if (!result.ok) setError(result.error ?? 'Approve failed.');
        });
    }

    async function onReject() {
        await withBusy(async () => {
            const result = await rejectSubmission({
                submissionId: submission.id,
                notes,
            });
            if (!result.ok) setError(result.error ?? 'Reject failed.');
        });
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="brass">{targetLabel}</Badge>
                            <span className="text-xs text-ink-soft font-mono">
                                {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </span>
                        </div>
                        <h3 className="font-display text-2xl text-ink">
                            {mode === 'edit' ? 'Editing — ' : ''}
                            {title}
                        </h3>
                        {author ? (
                            <p className="text-sm text-ink-soft">
                                by {author.display_name ?? author.username}{' '}
                                <span className="text-ink-soft/70">
                                    (@{author.username})
                                </span>
                            </p>
                        ) : null}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}
                        >
                            {mode === 'preview' ? (
                                <>
                                    <Pencil size={14} /> Edit
                                </>
                            ) : (
                                <>
                                    <Eye size={14} /> Preview
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardBody className="space-y-5">
                {mode === 'preview' ? (
                    <>
                        <MarkdownRender source={body} />
                        {photos.length > 0 ? (
                            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {photos.map((photo, i) => (
                                    <li
                                        key={photo.file_id ?? `${photo.url}-${i}`}
                                        className="overflow-hidden rounded-sm border border-brass-dark/40"
                                    >
                                        <img
                                            src={photo.thumbnail_url ?? photo.url}
                                            alt={photo.caption ?? ''}
                                            className="aspect-[4/3] w-full object-cover"
                                            loading="lazy"
                                        />
                                        {photo.caption ? (
                                            <p className="px-2 py-1 text-xs text-ink-soft">
                                                {photo.caption}
                                            </p>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </>
                ) : (
                    <>
                        <div>
                            <Label htmlFor={`title-${submission.id}`} required>
                                Title
                            </Label>
                            <Input
                                id={`title-${submission.id}`}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={140}
                            />
                        </div>
                        <div>
                            <Label required>Body</Label>
                            <MarkdownEditor value={body} onChange={setBody} minHeight={300} />
                        </div>
                        <div>
                            <Label>Photos</Label>
                            <PhotoUploader photos={photos} onChange={setPhotos} />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={onSaveEdit}
                                disabled={busy}
                            >
                                Save edits
                            </Button>
                        </div>
                    </>
                )}

                {error ? (
                    <p className="text-sm text-danger" role="alert">
                        {error}
                    </p>
                ) : null}

                {showRejectInput ? (
                    <div className="rounded-sm border border-danger/40 bg-danger/5 p-3">
                        <Label htmlFor={`notes-${submission.id}`} required>
                            Rejection note (sent to the author)
                        </Label>
                        <textarea
                            id={`notes-${submission.id}`}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-sm border border-brass-dark/50 bg-parchment/70 px-3 py-2 text-sm focus-visible:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                            placeholder="What needs to change before this can be published?"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowRejectInput(false)}
                                disabled={busy}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={onReject}
                                disabled={busy || !notes.trim()}
                            >
                                Send rejection
                            </Button>
                        </div>
                    </div>
                ) : null}
            </CardBody>

            <CardFooter className="flex flex-wrap items-center justify-end gap-2">
                {!showRejectInput ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRejectInput(true)}
                        disabled={busy}
                    >
                        <X size={14} /> Reject…
                    </Button>
                ) : null}
                <Button type="button" onClick={onApprove} disabled={busy}>
                    <Check size={14} />
                    {mode === 'edit' ? 'Save & approve' : 'Approve & publish'}
                </Button>
            </CardFooter>
        </Card>
    );
}
