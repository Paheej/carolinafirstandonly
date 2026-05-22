import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@cfo/database/server';

export async function POST(request: NextRequest) {
    const supabase = createServerSupabase(await cookies());
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
