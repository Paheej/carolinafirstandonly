import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { cn } from '@cfo/shared';

export interface MarkdownRenderProps {
    /** Markdown source. */
    source: string;
    className?: string;
}

// Extend the default sanitize schema to allow <figure>/<figcaption> and a
// small set of safe <img> attributes. Anything else (script, iframe, on*,
// javascript: urls) is still stripped by rehype-sanitize.
const schema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), 'figure', 'figcaption'],
    attributes: {
        ...defaultSchema.attributes,
        img: [
            ...(defaultSchema.attributes?.img ?? []),
            'loading',
            'decoding',
            'width',
            'height',
        ],
    },
};

/**
 * Markdown renderer that supports a small whitelist of raw HTML (figure,
 * figcaption, img) so seeded content can include captioned images.
 * User-submitted content still goes through rehype-sanitize, so scripts,
 * iframes, on* handlers, and javascript: URLs are stripped.
 *
 * Prose styling is hand-rolled in CSS rather than via @tailwindcss/typography
 * so the parchment palette and EB Garamond headings carry through cleanly.
 */
export function MarkdownRender({ source, className }: MarkdownRenderProps) {
    return (
        <div className={cn('cfo-prose', className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
            >
                {source}
            </ReactMarkdown>
        </div>
    );
}
