import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import { beginOAuth, isOAuthProvider, oauthConfigured } from '@/lib/calendar-oauth';

const OAUTH_COOKIE = 'cfo_cal_oauth';

/** GET /api/calendar-connect/google/start -> the provider's consent screen. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
    const { provider } = await params;
    const origin = request.nextUrl.origin;
    const back = (msg: string) => NextResponse.redirect(`${origin}/profile/settings?error=${encodeURIComponent(msg)}#busy`);
    if (!isOAuthProvider(provider)) return back('Unknown calendar provider.');
    if (!oauthConfigured(provider)) return back('That calendar provider isn’t set up on the site yet.');

    const cookieStore = await cookies();
    const {
        data: { user },
    } = await createServerSupabase(cookieStore).auth.getUser();
    if (!user) return NextResponse.redirect(`${origin}/auth/login?next=/profile/settings`);

    const { url, state, verifier } = beginOAuth(provider, origin);
    const res = NextResponse.redirect(url);
    res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, provider, uid: user.id }), {
        httpOnly: true,
        secure: origin.startsWith('https:'),
        sameSite: 'lax',
        path: '/api/calendar-connect',
        maxAge: 600,
    });
    return res;
}
