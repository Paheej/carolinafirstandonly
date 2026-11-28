#!/usr/bin/env node
/**
 * Resolve YouTube handles or channel URLs to channel IDs (UC...), for the
 * agent_sources seed. One-off; re-run it when a source is added.
 *
 *   node scripts/resolve-youtube-channels.mjs @ChapterValrak https://www.youtube.com/@AuspexTactics
 *
 * With YOUTUBE_API_KEY set it asks the YouTube Data API (channels.list
 * forHandle). Without one it reads the channel page's canonical link, which
 * is public. The agent itself needs no key: it reads each channel's public
 * uploads feed, https://www.youtube.com/feeds/videos.xml?channel_id=<id>.
 */

const UA = 'Mozilla/5.0 (compatible; CFO-news-agent/1.0)';

function handleOf(input) {
    const s = input.trim();
    const m = s.match(/youtube\.com\/(@[\w.-]+)/i);
    if (m) return m[1];
    if (s.startsWith('@')) return s;
    return `@${s.replace(/\s+/g, '')}`;
}

async function viaApi(handle, key) {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'id,snippet');
    url.searchParams.set('forHandle', handle);
    url.searchParams.set('key', key);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const body = await res.json();
    const ch = body.items?.[0];
    return ch ? { id: ch.id, title: ch.snippet?.title } : null;
}

async function viaPage(handle) {
    const res = await fetch(`https://www.youtube.com/${handle}`, { headers: { 'user-agent': UA, 'accept-language': 'en' } });
    if (!res.ok) throw new Error(`channel page ${res.status}`);
    const html = await res.text();
    const id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1]
        ?? html.match(/"channelId":"(UC[\w-]{22})"/)?.[1];
    const title = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
    return id ? { id, title } : null;
}

const inputs = process.argv.slice(2);
if (!inputs.length) {
    console.error('Usage: node scripts/resolve-youtube-channels.mjs <@handle|channel URL> ...');
    process.exit(1);
}
const key = process.env.YOUTUBE_API_KEY;
let failed = 0;
for (const input of inputs) {
    const handle = handleOf(input);
    try {
        const ch = key ? await viaApi(handle, key) : await viaPage(handle);
        if (!ch) throw new Error('not found');
        console.log(`${handle}\t${ch.id}\t${ch.title ?? ''}`);
    } catch (err) {
        failed++;
        console.log(`${handle}\tERROR\t${err.message}`);
    }
}
process.exit(failed ? 1 : 0);
