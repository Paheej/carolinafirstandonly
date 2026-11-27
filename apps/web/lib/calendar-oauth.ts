import { createHash, randomBytes } from 'node:crypto';
import { easternMidnight, mergeSpans, syncWindow, type Block } from './ics-busy';

/**
 * "Connect Google Calendar" / "Connect Outlook". Server only.
 *
 * Scopes are the narrowest each provider offers for busy times:
 *   Google    calendar.freebusy + calendar.calendarlist.readonly (no event details at all)
 *   Microsoft Calendars.ReadBasic (no bodies or attendees; we read start, end, showAs only)
 * Refresh tokens are encrypted by the caller before storage.
 */

export type OAuthProvider = 'google' | 'outlook';

export class OAuthSyncError extends Error {}

interface ProviderConfig {
    name: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientId: () => string | undefined;
    clientSecret: () => string | undefined;
    extraAuthParams: Record<string, string>;
}

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
    google: {
        name: 'Google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: [
            'openid',
            'email',
            'https://www.googleapis.com/auth/calendar.freebusy',
            'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
        ],
        clientId: () => process.env.GOOGLE_CLIENT_ID,
        clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
        extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' },
    },
    outlook: {
        name: 'Outlook',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scopes: ['openid', 'email', 'offline_access', 'Calendars.ReadBasic'],
        clientId: () => process.env.MICROSOFT_CLIENT_ID,
        clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
        extraAuthParams: { prompt: 'select_account' },
    },
};

export function isOAuthProvider(p: string): p is OAuthProvider {
    return p === 'google' || p === 'outlook';
}

export function oauthConfigured(p: OAuthProvider) {
    return Boolean(PROVIDERS[p].clientId() && PROVIDERS[p].clientSecret());
}

export function redirectUri(origin: string, p: OAuthProvider) {
    return `${origin}/api/calendar-connect/${p}/callback`;
}

/** Start: returns the provider URL plus the state/PKCE values to keep in a cookie. */
export function beginOAuth(p: OAuthProvider, origin: string) {
    const cfg = PROVIDERS[p];
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const url = new URL(cfg.authUrl);
    url.search = new URLSearchParams({
        client_id: cfg.clientId()!,
        redirect_uri: redirectUri(origin, p),
        response_type: 'code',
        scope: cfg.scopes.join(' '),
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        ...cfg.extraAuthParams,
    }).toString();
    return { url: url.toString(), state, verifier };
}

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
}

async function tokenRequest(p: OAuthProvider, body: Record<string, string>): Promise<TokenResponse> {
    const cfg = PROVIDERS[p];
    const res = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: cfg.clientId()!, client_secret: cfg.clientSecret()!, ...body }),
        signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !json.access_token) {
        if (json.error === 'invalid_grant') {
            throw new OAuthSyncError(`${cfg.name} stopped letting us see this calendar (access was removed or expired). Connect it again.`);
        }
        throw new OAuthSyncError(`${cfg.name} refused the request (${json.error ?? res.status}). Try connecting again.`);
    }
    return json;
}

/** The account email from the id_token we just received over TLS from the token endpoint. */
function emailFromIdToken(idToken?: string): string | null {
    try {
        const payload = JSON.parse(Buffer.from(idToken!.split('.')[1]!, 'base64url').toString('utf8'));
        return payload.email ?? payload.preferred_username ?? null;
    } catch {
        return null;
    }
}

/** Callback: code -> refresh token + account email. */
export async function finishOAuth(p: OAuthProvider, origin: string, code: string, verifier: string) {
    const t = await tokenRequest(p, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(origin, p),
        code_verifier: verifier,
    });
    if (!t.refresh_token) throw new OAuthSyncError(`${PROVIDERS[p].name} didn't grant ongoing access. Try connecting again.`);
    if (p === 'google' && !/calendar\.freebusy/.test(t.scope ?? '')) {
        throw new OAuthSyncError('Tick the box that lets us see your availability, then try again.');
    }
    return { refreshToken: t.refresh_token, email: emailFromIdToken(t.id_token) };
}

async function getJson<T>(url: string, init: RequestInit, who: string): Promise<T> {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    if (res.status === 401 || res.status === 403) throw new OAuthSyncError(`${who} stopped letting us see this calendar. Connect it again.`);
    if (!res.ok) throw new OAuthSyncError(`${who} answered with an error (${res.status}). We'll try again tomorrow.`);
    return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Busy times
// ---------------------------------------------------------------------------
async function googleBusy(accessToken: string): Promise<Block[]> {
    const auth = { authorization: `Bearer ${accessToken}` };
    const list = await getJson<{ items?: { id: string; selected?: boolean; primary?: boolean; hidden?: boolean }[] }>(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=freeBusyReader&maxResults=250',
        { headers: auth },
        'Google',
    );
    // Calendars they show in Google Calendar, minus Google's built-in holiday/birthday calendars.
    const ids = (list.items ?? [])
        .filter((c) => (c.primary || c.selected) && !c.hidden && !/\.v\.calendar\.google\.com$/.test(c.id))
        .map((c) => c.id)
        .slice(0, 50);
    if (!ids.length) ids.push('primary');

    const { from, to } = syncWindow();
    const spans: [number, number][] = [];
    // freeBusy limits how long one query's range can be, so ask 30 days at a time.
    for (let s = from.getTime(); s < to.getTime(); s += 30 * 86_400_000) {
        const e = Math.min(s + 30 * 86_400_000, to.getTime());
        const fb = await getJson<{ calendars?: Record<string, { busy?: { start: string; end: string }[] }> }>(
            'https://www.googleapis.com/calendar/v3/freeBusy',
            {
                method: 'POST',
                headers: { ...auth, 'content-type': 'application/json' },
                body: JSON.stringify({ timeMin: new Date(s).toISOString(), timeMax: new Date(e).toISOString(), items: ids.map((id) => ({ id })) }),
            },
            'Google',
        );
        for (const cal of Object.values(fb.calendars ?? {})) {
            for (const b of cal.busy ?? []) spans.push([Date.parse(b.start), Date.parse(b.end)]);
        }
    }
    return mergeSpans(spans);
}

interface GraphEvent {
    start: { dateTime: string };
    end: { dateTime: string };
    showAs?: string;
    isCancelled?: boolean;
    isAllDay?: boolean;
}

async function outlookBusy(accessToken: string): Promise<Block[]> {
    const { from, to } = syncWindow();
    const spans: [number, number][] = [];
    let url: string | undefined =
        `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}` +
        '&$select=start,end,showAs,isCancelled,isAllDay&$top=250';
    for (let page = 0; url && page < 20; page++) {
        const r: { value?: GraphEvent[]; '@odata.nextLink'?: string } = await getJson(
            url,
            { headers: { authorization: `Bearer ${accessToken}`, prefer: 'outlook.timezone="UTC"' } },
            'Outlook',
        );
        for (const ev of r.value ?? []) {
            if (ev.isCancelled || ev.showAs === 'free') continue;
            if (ev.isAllDay) spans.push([easternMidnight(ev.start.dateTime.slice(0, 10)), easternMidnight(ev.end.dateTime.slice(0, 10))]);
            else spans.push([Date.parse(`${ev.start.dateTime.replace(/Z?$/, '')}Z`), Date.parse(`${ev.end.dateTime.replace(/Z?$/, '')}Z`)]);
        }
        url = r['@odata.nextLink'];
    }
    return mergeSpans(spans);
}

/** Refresh access, read busy times. Returns a rotated refresh token when the provider issues one. */
export async function oauthBusyBlocks(p: OAuthProvider, refreshToken: string): Promise<{ blocks: Block[]; refreshToken?: string }> {
    if (!oauthConfigured(p)) throw new OAuthSyncError(`${PROVIDERS[p].name} calendar connections aren't set up on the site yet.`);
    const t = await tokenRequest(p, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        ...(p === 'outlook' ? { scope: PROVIDERS.outlook.scopes.join(' ') } : {}),
    });
    const blocks = p === 'google' ? await googleBusy(t.access_token) : await outlookBusy(t.access_token);
    return { blocks, refreshToken: t.refresh_token && t.refresh_token !== refreshToken ? t.refresh_token : undefined };
}
