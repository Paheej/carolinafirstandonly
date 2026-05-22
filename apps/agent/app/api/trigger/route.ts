import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 6: admin-only manual trigger.
export async function POST() {
    return NextResponse.json({ status: 'not_implemented', phase: 6 }, { status: 501 });
}
