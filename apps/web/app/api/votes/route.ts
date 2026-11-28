import { NextResponse, type NextRequest } from 'next/server';
import { createServiceSupabase } from '@cfo/database/server';
import { VISITOR_COOKIE, hmac, isVisitorId } from '@/lib/news';

/**
 * POST /api/votes  { post_id, vote: 1 | -1 | 0, visitor_id }
 * Anyone can vote, signed in or not. The visitor is the cfo_vid cookie, or on
 * a first vote the FingerprintJS ID the browser sends (then kept in the
 * cookie). cast_news_vote() limits each IP to 30 votes per 10 minutes.
 */
export async function POST(request: NextRequest) {
    // Same-site requests only.
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ error: 'Cross-site vote refused.' }, { status: 403 });
    }

    let body: { post_id?: unknown; vote?: unknown; visitor_id?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });
    }
    const postId = typeof body.post_id === 'string' && /^[0-9a-f-]{36}$/.test(body.post_id) ? body.post_id : null;
    const vote = body.vote === 1 || body.vote === -1 || body.vote === 0 ? body.vote : null;
    if (!postId || vote === null) {
        return NextResponse.json({ error: 'post_id and vote (1, -1 or 0) are required.' }, { status: 400 });
    }

    const cookieVid = request.cookies.get(VISITOR_COOKIE)?.value;
    const vid = isVisitorId(cookieVid) ? cookieVid : isVisitorId(body.visitor_id) ? body.visitor_id : null;
    if (!vid) return NextResponse.json({ error: 'Voting needs JavaScript turned on.' }, { status: 400 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;

    const { data, error } = await createServiceSupabase().rpc('cast_news_vote', {
        p_post: postId,
        p_fingerprint: hmac('visitor', vid),
        p_ip: ip ? hmac('ip', ip) : null,
        p_vote: vote,
    });
    if (error) {
        const status = /Too many votes/.test(error.message) ? 429 : /not found/.test(error.message) ? 404 : 400;
        return NextResponse.json({ error: error.message }, { status });
    }
    const row = data?.[0];
    const res = NextResponse.json(
        { upvotes: row?.upvotes ?? 0, downvotes: row?.downvotes ?? 0, my_vote: row?.my_vote ?? vote },
        { headers: { 'cache-control': 'private, no-store' } },
    );
    if (cookieVid !== vid) {
        res.cookies.set(VISITOR_COOKIE, vid, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 730,
        });
    }
    return res;
}
