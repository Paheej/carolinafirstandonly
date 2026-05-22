import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 6 will implement the full pipeline (fetchers, dedupe, Claude
// summarization, draft persistence, admin notification fan-out).
export async function GET() {
    return NextResponse.json({ status: 'not_implemented', phase: 6 }, { status: 501 });
}
