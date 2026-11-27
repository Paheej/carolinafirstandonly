import { NextResponse, type NextRequest } from 'next/server';
import { getEventBySlug } from '@/lib/events';
import { buildCalendar } from '@/lib/ics';

/** One game day as an .ics file (Apple Calendar, Thunderbird, anything). RLS applies. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return new NextResponse('Not found', { status: 404 });
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const body = buildCalendar([
        {
            id: event.id,
            title: event.title,
            description: event.description_md,
            location: event.location,
            url: `${origin}/events/${event.slug}`,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            updated_at: event.updated_at,
            sequence: event.ics_sequence,
            cancelled: !!event.cancelled_at,
        },
    ]);
    return new NextResponse(body, {
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
            'Cache-Control': 'private, no-store',
        },
    });
}
