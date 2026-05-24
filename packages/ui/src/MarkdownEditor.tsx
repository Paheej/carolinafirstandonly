'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@cfo/shared';

import '@uiw/react-md-editor/markdown-editor.css';

// SSR off — the editor uses browser-only APIs (CodeMirror, ResizeObserver).
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    /** Visual rows; the editor self-resizes within this minimum height. */
    minHeight?: number;
    placeholder?: string;
    className?: string;
    /** Hide preview pane (handy for compact admin edit views). */
    previewMode?: 'live' | 'edit' | 'preview';
}

/**
 * Wraps @uiw/react-md-editor in a parchment-themed container. Force the
 * data-color-mode attribute on the wrapper so the editor's dark/light token
 * set follows our palette rather than the user OS preference.
 */
export function MarkdownEditor({
    value,
    onChange,
    minHeight = 360,
    placeholder = 'Write your recap in markdown…',
    className,
    previewMode = 'live',
}: MarkdownEditorProps) {
    return (
        <div
            data-color-mode="light"
            className={cn(
                'cfo-md-editor rounded-sm border border-brass-dark/50 bg-parchment/70',
                'focus-within:border-brass focus-within:ring-2 focus-within:ring-brass/60',
                className,
            )}
        >
            <MDEditor
                value={value}
                onChange={(next) => onChange(next ?? '')}
                preview={previewMode}
                height={minHeight}
                textareaProps={{ placeholder }}
                visibleDragbar={true}
            />
        </div>
    );
}
