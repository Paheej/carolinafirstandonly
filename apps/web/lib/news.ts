import { createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
import { createServerSupabase, createServiceSupabase } from '@cfo/database/server';
import type { NewsCategory, NewsPost } from '@cfo/database/types';

export type NewsSort = 'hot' | 'top' | 'new';
export const NEWS_PAGE_SIZE = 20;
export const VISITOR_COOKIE = 'cfo_vid';

export function parseSort(v: string | undefined): NewsSort {
    return v === 'top' || v === 'new' ? v : 'hot';
}

export async function getNewsCategories(): Promise<NewsCategory[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.from('news_categories').select('*').order('display_order');
    return data ?? [];
}

// Cursor = the last row's sort value and id, so pages don't shift as votes come in.
type Cursor = [string | number, string];
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string | undefined): Cursor | null {
    if (!s) return null;
    try {
        const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
        if (Array.isArray(c) && c.length === 2 && /^[0-9a-f-]{36}$/.test(String(c[1])) && ['string', 'number'].includes(typeof c[0])) {
            return c as Cursor;
        }
    } catch {
        /* bad cursor: start from the top */
    }
    return null;
}

const SORT_COLUMN = { hot: 'hot_score', top: 'score', new: 'published_at' } as const;

export async function listNews(opts: {
    sort: NewsSort;
    categoryId?: string | null;
    tag?: string | null;
    cursor?: string;
}): Promise<{ posts: NewsPost[]; nextCursor: string | null }> {
    const supabase = createServerSupabase(await cookies());
    const col = SORT_COLUMN[opts.sort];
    let query = supabase
        .from('news_posts')
        .select('*')
        .eq('status', 'published')
        .order(col, { ascending: false })
        .order('id', { ascending: false })
        .limit(NEWS_PAGE_SIZE + 1);
    if (opts.categoryId) query = query.eq('category_id', opts.categoryId);
    if (opts.tag) query = query.contains('tags', [opts.tag]);
    const cursor = decodeCursor(opts.cursor);
    if (cursor) {
        const [value, id] = cursor;
        if (col === 'hot_score' && typeof value === 'number') {
            // hot_score is a double and comes back over JSON rounded, so "equal"
            // means within 1e-6 (about 0.05 s of age).
            const lo = value - 1e-6;
            const hi = value + 1e-6;
            query = query.or(`hot_score.lt.${lo},and(hot_score.gte.${lo},hot_score.lte.${hi},id.lt.${id})`);
        } else {
            const v = JSON.stringify(String(value));
            query = query.or(`${col}.lt.${v},and(${col}.eq.${v},id.lt.${id})`);
        }
    }
    const { data } = await query;
    const rows = data ?? [];
    const posts = rows.slice(0, NEWS_PAGE_SIZE);
    const last = posts[posts.length - 1];
    const nextCursor =
        rows.length > NEWS_PAGE_SIZE && last ? encodeCursor([last[col] as string | number, last.id]) : null;
    return { posts, nextCursor };
}

/** Published posts for everyone; admins also get drafts (RLS decides). */
export async function getNewsPostBySlug(slug: string): Promise<NewsPost | null> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.from('news_posts').select('*').eq('slug', slug).maybeSingle();
    return data ?? null;
}

export async function getNewsPostById(id: string): Promise<NewsPost | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.from('news_posts').select('*').eq('id', id).maybeSingle();
    return data ?? null;
}

export async function listNewsForAdmin(): Promise<NewsPost[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('news_posts')
        .select('*')
        .order('status')
        .order('updated_at', { ascending: false })
        .limit(200);
    return data ?? [];
}

export async function getAuthorName(authorId: string | null): Promise<string | null> {
    if (!authorId) return null;
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.from('profiles').select('username, display_name').eq('id', authorId).maybeSingle();
    return data ? data.display_name ?? data.username : null;
}

// ---------------------------------------------------------------------------
// Anonymous voting. Raw visitor IDs and IPs never reach the database: both are
// HMAC'd with FINGERPRINT_HMAC_SECRET (the same value everywhere, since preview
// and production share a database).
// ---------------------------------------------------------------------------
export function isVisitorId(v: unknown): v is string {
    return typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

export function hmac(kind: 'visitor' | 'ip', value: string): string {
    const secret = process.env.FINGERPRINT_HMAC_SECRET;
    if (!secret) throw new Error('FINGERPRINT_HMAC_SECRET is not set');
    return createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
}

/** This visitor's votes on the given posts, from their cookie. Empty if none. */
export async function getMyVotes(postIds: string[]): Promise<Record<string, number>> {
    const vid = (await cookies()).get(VISITOR_COOKIE)?.value;
    if (!postIds.length || !isVisitorId(vid) || !process.env.FINGERPRINT_HMAC_SECRET) return {};
    const { data } = await createServiceSupabase().rpc('my_news_votes', {
        p_fingerprint: hmac('visitor', vid),
        p_posts: postIds,
    });
    return Object.fromEntries((data ?? []).map((r) => [r.post_id, r.vote]));
}

export function sourceHost(url: string | null): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

export function fmtNewsDate(iso: string | null): string | null {
    return iso
        ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
        : null;
}
