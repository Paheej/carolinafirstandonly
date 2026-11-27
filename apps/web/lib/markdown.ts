/**
 * Small helpers for pulling display bits out of stored markdown (seeded
 * archive content keeps images inline rather than in `photos`).
 */

const IMG_MD = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/;
const IMG_HTML = /<img[^>]+src=["']([^"']+)["']/i;

export function firstImageUrl(md: string | null | undefined): string | null {
    if (!md) return null;
    const m = md.match(IMG_MD) ?? md.match(IMG_HTML);
    return m?.[1] ?? null;
}

/** First real paragraph, stripped of markdown syntax, trimmed to `max` chars. */
export function excerpt(md: string | null | undefined, max = 180): string | null {
    if (!md) return null;
    const body = md.replace(/^---[\s\S]*?---\s*/, ''); // front matter
    const para = body
        .split(/\n\s*\n/)
        .map((b) => b.trim())
        .find(
            (b) =>
                b &&
                !b.startsWith('#') &&
                !b.startsWith('!') &&
                !b.startsWith('<') &&
                !b.startsWith('>') &&
                !b.startsWith('|') &&
                !b.startsWith('[') &&
                !b.startsWith('_This page existed'),
        );
    if (!para) return null;
    const text = para
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (text.length <= max) return text;
    return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

/** ImageKit supports URL transforms; ask for a sized copy when we can. */
export function sizedImage(url: string, width: number): string {
    if (!url.includes('ik.imagekit.io')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}tr=w-${width}`;
}

/** Drop a leading "# Title" when it repeats the page title shown in the header. */
export function stripLeadingTitle(md: string, title: string): string {
    const body = md.replace(/^---[\s\S]*?---\s*/, '');
    const m = body.match(/^\s*#\s+(.+?)\s*\n/);
    if (!m || !m[1]) return body;
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const heading = norm(m[1]);
    const page = norm(title);
    if (heading === page || page.includes(heading) || heading.includes(page)) {
        return body.slice(m[0].length);
    }
    return body;
}

/** Button text for a campaign tracked on another site. */
export function externalLabel(url: string): string {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        if (host === 'campaign-chronicle.app') return 'Open the Chronicle';
        return `Open ${host}`;
    } catch {
        return 'Open the campaign site';
    }
}
