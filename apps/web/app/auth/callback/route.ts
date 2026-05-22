import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@cfo/database/server';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const next = url.searchParams.get('next') ?? '/';

    if (code) {
        const supabase = createServerSupabase(await cookies());
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
            const target = new URL('/auth/login', request.url);
            target.searchParams.set('error', error.message);
            return NextResponse.redirect(target);
        }
    }

    return NextResponse.redirect(new URL(next, request.url));
}
