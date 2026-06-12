'use client';

import * as React from 'react';
import { Button } from '@cfo/ui';
import { Upload, X, ImagePlus } from 'lucide-react';
import type { RecapPhoto } from '@cfo/database/types';

const MAX_PHOTOS = 10;
const MAX_MB = 8;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export interface PhotoUploaderProps {
    photos: RecapPhoto[];
    onChange: (photos: RecapPhoto[]) => void;
    folder?: string;
}

interface UploadAuthResponse {
    signature: string;
    expire: number;
    token: string;
    publicKey: string;
}

interface ImageKitUploadResponse {
    fileId: string;
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    name: string;
}

export function PhotoUploader({
    photos,
    onChange,
    folder = '/recaps',
}: PhotoUploaderProps) {
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        setError(null);

        const remaining = MAX_PHOTOS - photos.length;
        if (remaining <= 0) {
            setError(`You've hit the ${MAX_PHOTOS}-photo limit.`);
            return;
        }

        const queue = Array.from(files).slice(0, remaining);
        for (const file of queue) {
            if (file.size > MAX_BYTES) {
                setError(`"${file.name}" is over ${MAX_MB}MB.`);
                return;
            }
        }

        setUploading(true);
        try {
            const authRes = await fetch('/api/imagekit/auth', { cache: 'no-store' });
            if (!authRes.ok) {
                throw new Error('Could not fetch upload signature.');
            }
            const auth = (await authRes.json()) as UploadAuthResponse;

            const uploaded: RecapPhoto[] = [];
            for (const file of queue) {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('fileName', file.name);
                fd.append('folder', folder);
                fd.append('publicKey', auth.publicKey);
                fd.append('signature', auth.signature);
                fd.append('expire', String(auth.expire));
                fd.append('token', auth.token);
                fd.append('useUniqueFileName', 'true');

                const res = await fetch(
                    'https://upload.imagekit.io/api/v1/files/upload',
                    { method: 'POST', body: fd },
                );
                if (!res.ok) {
                    const detail = await res.text().catch(() => '');
                    throw new Error(`ImageKit refused upload: ${detail || res.status}`);
                }
                const result = (await res.json()) as ImageKitUploadResponse;
                uploaded.push({
                    url: result.url,
                    thumbnail_url: result.thumbnailUrl,
                    file_id: result.fileId,
                    width: result.width,
                    height: result.height,
                    caption: '',
                });
            }

            onChange([...photos, ...uploaded]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    }

    function updateCaption(index: number, caption: string) {
        const target = photos[index];
        if (!target) return;
        const next = photos.slice();
        next[index] = { ...target, caption };
        onChange(next);
    }

    function remove(index: number) {
        const next = photos.slice();
        next.splice(index, 1);
        onChange(next);
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.12em] text-ink-soft">
                    {photos.length} / {MAX_PHOTOS} photos · max {MAX_MB}MB each
                </span>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={uploading || photos.length >= MAX_PHOTOS}
                    onClick={() => inputRef.current?.click()}
                >
                    {uploading ? (
                        <>
                            <Upload size={14} className="animate-pulse" /> Uploading…
                        </>
                    ) : (
                        <>
                            <ImagePlus size={14} /> Add photos
                        </>
                    )}
                </Button>
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>

            {error ? (
                <p className="text-sm text-danger" role="alert">
                    {error}
                </p>
            ) : null}

            {photos.length === 0 ? (
                <div className="rounded-sm border border-dashed border-brass-dark/50 bg-parchment/40 px-4 py-8 text-center text-sm text-ink-soft">
                    No photos yet. Battle reports go down better with miniatures
                    in the frame.
                </div>
            ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {photos.map((photo, i) => (
                        <li
                            key={photo.file_id ?? photo.url}
                            className="relative overflow-hidden rounded-sm border border-brass-dark/40 bg-parchment"
                        >
                            <div className="aspect-[4/3] w-full bg-parchment-dark/50">
                                <img
                                    src={photo.thumbnail_url ?? photo.url}
                                    alt={photo.caption || ''}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="p-2">
                                <input
                                    type="text"
                                    value={photo.caption ?? ''}
                                    onChange={(e) => updateCaption(i, e.target.value)}
                                    placeholder="Caption (optional)"
                                    className="w-full rounded-sm border border-brass-dark/40 bg-parchment/70 px-2 py-1 text-sm placeholder:text-ink-soft/60 focus-visible:border-brass focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => remove(i)}
                                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-sm bg-ink/80 text-parchment shadow hover:bg-danger"
                                aria-label={`Remove photo ${i + 1}`}
                            >
                                <X size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
