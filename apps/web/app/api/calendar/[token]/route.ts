import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cfo/database/types';
import { buildCalendar } from '@/lib/ics';

/**
 * Personal subscription feed: /api/calendar/<token>.ics
 * Calendar apps fetch this without cookies, so the secret token is the only
 * credential. calendar_feed_events() is a security-definer function that
 * returns just that person's game days.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const token = (await params).token.replace(/\.ics$/, '');
    if (!/^[a-f0-9]{64}$/.test(token)) return new NextResponse('Not found', { status: 404 });

    const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
    });
    const { data, error } = await supabase.rpc('calendar_feed_events', { p_token: token });
    if (error) return new NextResponse('Feed unavailable', { status: 500 });
    // An unknown token and a feed with no events look the same, on purpose.
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const body = buildCalendar(
        (data ?? []).map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description_md,
            location: e.location,
            url: `${origin}/events/${e.slug}`,
            starts_at: e.starts_at,
            ends_at: e.ends_at,
            updated_at: e.updated_at,
            sequence: e.ics_sequence,
            cancelled: !!e.cancelled_at,
            tentative: e.my_status === 'maybe' || e.my_status === 'waitlist',
        })),
        { name: 'CF&O game days' },
    );
    return new NextResponse(body, {
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Cache-Control': 'private, max-age=300',
        },
    });
}
