import { NextResponse, type NextRequest } from 'next/server';
import { runAgent } from '@/lib/agent/pipeline';

// Up to 30 Claude calls, four at a time. Fluid compute allows 300 s on Hobby.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/** Daily Vercel Cron, 6 am Eastern (see vercel.json). Vercel sends Authorization: Bearer $CRON_SECRET. */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const summary = await runAgent({ trigger: 'cron' });
    return NextResponse.json(summary, { status: summary.status === 'failed' ? 500 : 200 });
}
