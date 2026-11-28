import Parser from 'rss-parser';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import type { AgentSource } from '@cfo/database/types';

/** One thing a source published, ready to summarize. */
export interface SourceItem {
    url: string;
    title: string;
    publishedAt: string | null;
    /** Plain text, already trimmed to MAX_CONTENT_CHARS. Empty until loaded. */
    content: string;
    /** What the text came from, for the draft review screen. */
    contentFrom: 'feed' | 'article' | 'video_description';
}

export interface SourceConfig {
    link_pattern?: string;
    exclude_pattern?: string;
    max_items?: number;
}

const UA = 'Mozilla/5.0 (compatible; CFO-news-agent/1.0; +https://carolinafirstandonly.com)';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 3 * 1024 * 1024;
/** About 8,000 tokens, the spec's cap on what each item sends to Claude. */
export const MAX_CONTENT_CHARS = 30_000;
/** Feed text shorter than this is probably a teaser, so read the article itself. */
const TEASER_CHARS = 1_500;

export function configOf(source: AgentSource): SourceConfig {
    const c = source.config;
    return c && typeof c === 'object' && !Array.isArray(c) ? (c as SourceConfig) : {};
}

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) throw new Error(`${new URL(url).hostname} sent a page over 3 MB`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error(`${new URL(url).hostname} sent a page over 3 MB`);
    // The Miniatures Page is ISO-8859-1. Honour the declared charset.
    const charset = res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
    try {
        return new TextDecoder(charset && charset !== 'utf8' ? charset : 'utf-8').decode(buf);
    } catch {
        return new TextDecoder('utf-8').decode(buf);
    }
}

export function htmlToText(html: string): string {
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
    for (const el of document.querySelectorAll('script, style, noscript, iframe')) el.remove();
    return clean(document.body?.textContent ?? '');
}

function clean(text: string): string {
    return text
        .replace(/ /g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, MAX_CONTENT_CHARS);
}

/** The readable body of an article page (Mozilla Readability). */
export async function readArticle(url: string): Promise<{ title: string | null; text: string }> {
    const html = await fetchText(url);
    const { document } = parseHTML(html);
    // Readability resolves relative links against the document URL.
    const article = new Readability(document as unknown as Document, { charThreshold: 300 }).parse();
    const text = article?.textContent ? clean(article.textContent) : htmlToText(html);
    return { title: article?.title?.trim() || null, text };
}

function filterLinks(items: SourceItem[], cfg: SourceConfig): SourceItem[] {
    const include = cfg.link_pattern ? new RegExp(cfg.link_pattern) : null;
    const exclude = cfg.exclude_pattern ? new RegExp(cfg.exclude_pattern) : null;
    return items.filter((i) => /^https?:\/\//.test(i.url) && (!include || include.test(i.url)) && (!exclude || !exclude.test(i.url)));
}

// ---------------------------------------------------------------------------
// RSS
// ---------------------------------------------------------------------------
type FeedItem = { 'content:encoded'?: string; 'media:group'?: { 'media:description'?: string[] } };
const parser: Parser<Record<string, unknown>, FeedItem> = new Parser({
    customFields: { item: ['content:encoded', 'media:group'] },
});

async function fetchRss(source: AgentSource): Promise<SourceItem[]> {
    const feed = await parser.parseString(await fetchText(source.url));
    return feed.items.map((it) => {
        const html = it['content:encoded'] ?? it.content ?? it.contentSnippet ?? '';
        return {
            url: (it.link ?? '').trim(),
            title: (it.title ?? '').trim(),
            publishedAt: it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : null),
            content: htmlToText(html),
            contentFrom: 'feed' as const,
        };
    });
}

// ---------------------------------------------------------------------------
// YouTube. With YOUTUBE_API_KEY: the Data API's uploads playlist. Without one,
// or if the API fails: the channel's public Atom feed. Either way the agent
// works from the title and description, since the API only hands captions to
// the video's owner (CLAUDE.md open item 4).
// ---------------------------------------------------------------------------
async function fetchYouTube(source: AgentSource): Promise<SourceItem[]> {
    const channel = source.channel_id;
    if (!channel) throw new Error('No channel ID. Run scripts/resolve-youtube-channels.mjs.');
    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
        try {
            return await fetchYouTubeApi(channel, key);
        } catch (err) {
            console.warn(`[news-agent] YouTube API failed for ${source.name}, using the feed`, err);
        }
    }
    const feed = await parser.parseString(await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`));
    return feed.items.map((it) => ({
        url: (it.link ?? '').trim(),
        title: (it.title ?? '').trim(),
        publishedAt: it.isoDate ?? null,
        content: clean(it['media:group']?.['media:description']?.[0] ?? ''),
        contentFrom: 'video_description' as const,
    }));
}

async function fetchYouTubeApi(channel: string, key: string): Promise<SourceItem[]> {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', `UU${channel.slice(2)}`);
    url.searchParams.set('maxResults', '15');
    url.searchParams.set('key', key);
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) throw new Error(`YouTube API answered ${res.status}`);
    const body = (await res.json()) as {
        items?: { snippet?: { title?: string; description?: string; publishedAt?: string; resourceId?: { videoId?: string } }; contentDetails?: { videoPublishedAt?: string } }[];
    };
    return (body.items ?? [])
        .filter((i) => i.snippet?.resourceId?.videoId)
        .map((i) => ({
            url: `https://www.youtube.com/watch?v=${i.snippet!.resourceId!.videoId}`,
            title: (i.snippet?.title ?? '').trim(),
            publishedAt: i.contentDetails?.videoPublishedAt ?? i.snippet?.publishedAt ?? null,
            content: clean(i.snippet?.description ?? ''),
            contentFrom: 'video_description' as const,
        }));
}

// ---------------------------------------------------------------------------
// Web scrape: the index page's links that match link_pattern, newest first as
// the page lists them. Each article is read later, only if it's new.
// ---------------------------------------------------------------------------
async function fetchIndex(source: AgentSource): Promise<SourceItem[]> {
    const html = await fetchText(source.url);
    const { document } = parseHTML(html);
    const seen = new Set<string>();
    const items: SourceItem[] = [];
    for (const a of document.querySelectorAll('a[href]')) {
        let href: string;
        try {
            href = new URL(a.getAttribute('href') ?? '', source.url).toString().split('#')[0]!;
        } catch {
            continue;
        }
        if (seen.has(href) || href === source.url) continue;
        seen.add(href);
        items.push({ url: href, title: clean(a.textContent ?? ''), publishedAt: null, content: '', contentFrom: 'article' });
    }
    return items;
}

/** The source's recent items, filtered by its config. Content may be empty (see loadContent). */
export async function fetchSource(source: AgentSource): Promise<SourceItem[]> {
    const cfg = configOf(source);
    const items =
        source.source_type === 'rss' ? await fetchRss(source)
        : source.source_type === 'youtube' ? await fetchYouTube(source)
        : await fetchIndex(source);
    return filterLinks(items, cfg).filter((i) => !/#shorts\b/i.test(i.title));
}

/** Make sure the item has enough text to summarize: read the article when the feed only gave a teaser. */
export async function loadContent(item: SourceItem): Promise<SourceItem> {
    if (item.contentFrom === 'video_description') return item;
    if (item.content.length >= TEASER_CHARS) return item;
    try {
        const article = await readArticle(item.url);
        if (article.text.length > item.content.length) {
            return { ...item, title: item.title || article.title || item.url, content: article.text, contentFrom: 'article' };
        }
    } catch (err) {
        if (!item.content) throw err;
    }
    return item;
}
