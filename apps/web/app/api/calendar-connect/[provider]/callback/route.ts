import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';
import { finishOAuth, isOAuthProvider, OAuthSyncError } from '@/lib/calendar-oauth';
import { encryptSecret, providerName, syncConnection } from '@/lib/calendar-sync';

const OAUTH_COOKIE = 'cfo_cal_oauth';

/** The provider sends the member back here with ?code&state. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
    const { provider } = await params;
    const origin = request.nextUrl.origin;
    const done = (kind: 'notice' | 'error', msg: string) => {
        const res = NextResponse.redirect(`${origin}/profile/settings?${kind}=${encodeURIComponent(msg)}#busy`);
        res.cookies.set(OAUTH_COOKIE, '', { path: '/api/calendar-connect', maxAge: 0 });
        return res;
    };
    if (!isOAuthProvider(provider)) return done('error', 'Unknown calendar provider.');

    const q = request.nextUrl.searchParams;
    if (q.get('error')) {
        return done('error', q.get('error') === 'access_denied' ? 'No calendar connected: access wasn’t allowed.' : 'The calendar sign-in didn’t finish. Try again.');
    }

    const cookieStore = await cookies();
    let saved: { state?: string; verifier?: string; provider?: string; uid?: string } = {};
    try {
        saved = JSON.parse(cookieStore.get(OAUTH_COOKIE)?.value ?? '{}');
    } catch {
        /* treated as missing below */
    }
    const supabase = createServerSupabase(cookieStore);
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return done('error', 'Sign in, then connect your calendar again.');
    const code = q.get('code');
    if (!code || !saved.state || saved.state !== q.get('state') || saved.provider !== provider || saved.uid !== user.id || !saved.verifier) {
        return done('error', 'That calendar sign-in expired or didn’t match. Try again.');
    }

    let refreshToken: string;
    let email: string | null;
    try {
        ({ refreshToken, email } = await finishOAuth(provider, origin, code, saved.verifier));
    } catch (e) {
        return done('error', e instanceof OAuthSyncError ? e.message : 'Couldn’t finish connecting. Try again.');
    }

    // Reconnecting the same account replaces its token instead of adding a duplicate.
    const encrypted = encryptSecret(refreshToken);
    const { data: existing } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('provider', provider)
        .eq('account', email ?? '')
        .maybeSingle();
    const write = existing
        ? supabase.from('calendar_connections').update({ encrypted_secret: encrypted, enabled: true, last_error: null }).eq('id', existing.id)
        : supabase.from('calendar_connections').insert({ user_id: user.id, provider, label: providerName(provider, null), account: email, encrypted_secret: encrypted });
    const { data: conn, error } = await write.select('id, provider, encrypted_secret').single();
    if (error || !conn) return done('error', error?.message ?? 'Couldn’t save the connection.');

    const res = await syncConnection(conn);
    revalidatePath('/profile/settings');
    if (!res.ok) return done('error', `Connected, but the first sync failed: ${res.error}`);
    return done('notice', `${providerName(provider, null)} connected. Found ${res.blocks} busy ${res.blocks === 1 ? 'stretch' : 'stretches'} in the next 90 days.`);
}
