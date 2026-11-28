import { NextResponse, type NextRequest } from 'next/server';
import { syncAll } from '@/lib/calendar-sync';

export const maxDuration = 60;

/** Daily Vercel Cron (see vercel.json). Vercel sends Authorization: Bearer $CRON_SECRET. */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await syncAll();
    console.log('[calendar-sync] cron', result);
    return NextResponse.json(result);
}
