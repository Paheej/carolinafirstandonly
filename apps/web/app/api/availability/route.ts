import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';

/**
 * GET /api/availability?group_id=&start=&end=&days=
 * Counts only ("5 of 8 free"), from group_availability(), which checks that
 * the caller is in the group.
 */
export async function GET(request: NextRequest) {
    const p = request.nextUrl.searchParams;
    const groupId = p.get('group_id') ?? '';
    const start = p.get('start') ?? '';
    const end = p.get('end') ?? '';
    const days = Math.min(21, Math.max(1, Number(p.get('days') ?? 1) || 1));
    if (!/^[0-9a-f-]{36}$/.test(groupId) || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
        return NextResponse.json({ error: 'group_id, start and end are required.' }, { status: 400 });
    }
    const supabase = createServerSupabase(await cookies());
    const { data, error } = await supabase.rpc('group_availability', { p_group: groupId, p_start: start, p_end: end, p_days: days });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ days: data }, { headers: { 'cache-control': 'private, no-store' } });
}
