import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@cfo/shared';

export interface MarkdownRenderProps {
    /** Markdown source. */
    source: string;
    className?: string;
}

/**
 * Safe markdown renderer. `react-markdown` escapes raw HTML by default;
 * we never pass `rehype-raw` so user-submitted content can't inject HTML.
 *
 * Prose styling is hand-rolled in CSS rather than via @tailwindcss/typography
 * so the parchment palette and EB Garamond headings carry through cleanly.
 */
export function MarkdownRender({ source, className }: MarkdownRenderProps) {
    return (
        <div className={cn('cfo-prose', className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
        </div>
    );
}
