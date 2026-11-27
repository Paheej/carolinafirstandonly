import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createServiceSupabase } from '@cfo/database/server';
import type { CalendarConnection, Json } from '@cfo/database/types';
import { busyBlocksFromIcs, type Block } from './ics-busy';
import { OAuthSyncError, oauthBusyBlocks } from './calendar-oauth';

/**
 * Busy-time sync. Server only.
 *
 * A member pastes a private calendar link (iCloud public calendar, Google's
 * "secret address in iCal format", Outlook's published calendar). We encrypt
 * it with AES-256-GCM (TOKEN_ENCRYPTION_KEY) before it touches the database,
 * fetch it daily, and keep only start/end times: no titles, places or people.
 */

// ---------------------------------------------------------------------------
// Encryption: "v1.<iv>.<tag>.<ciphertext>", all base64url
// ---------------------------------------------------------------------------
function key(): Buffer {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    const k = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
    if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return k;
}

export function encryptSecret(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key(), iv);
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', iv, c.getAuthTag(), ct].map((x) => (typeof x === 'string' ? x : x.toString('base64url'))).join('.');
}

export function decryptSecret(blob: string): string {
    const [v, iv, tag, ct] = blob.split('.');
    if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognized secret format');
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Links: only the big three calendar hosts, so the server can't be pointed at
// anything else (internal addresses, arbitrary sites).
// ---------------------------------------------------------------------------
const ALLOWED_HOSTS = [/(^|\.)icloud\.com$/, /^calendar\.google\.com$/, /^outlook\.(live|office|office365)\.com$/];

export function hostAllowed(host: string) {
    return ALLOWED_HOSTS.some((re) => re.test(host.toLowerCase()));
}

export function providerName(provider: CalendarConnection['provider'], host: string | null) {
    if (provider === 'google') return 'Google Calendar';
    if (provider === 'outlook') return 'Outlook';
    if (!host) return 'Calendar';
    if (/icloud\.com$/.test(host)) return 'iCloud';
    if (/google\.com$/.test(host)) return 'Google';
    if (/outlook\./.test(host)) return 'Outlook';
    return 'Calendar';
}

/** Accepts webcal:// or https:// links from the allowed hosts. Returns the https URL or an error for people. */
export function normalizeCalendarLink(input: string): { url: URL } | { error: string } {
    let url: URL;
    try {
        url = new URL(input.trim().replace(/^webcals?:\/\//i, 'https://'));
    } catch {
        return { error: "That doesn't look like a link. Paste the whole thing, starting with webcal:// or https://." };
    }
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:') return { error: 'Calendar links start with webcal:// or https://.' };
    if (!hostAllowed(url.hostname)) {
        return { error: 'Use a link from iCloud, Google Calendar or Outlook. Other calendar sites aren’t supported yet.' };
    }
    return { url };
}

const MAX_BYTES = 5 * 1024 * 1024;

export async function fetchIcs(start: URL): Promise<string> {
    let url = start;
    for (let hop = 0; hop < 4; hop++) {
        const res = await fetch(url, {
            redirect: 'manual',
            signal: AbortSignal.timeout(15_000),
            headers: { accept: 'text/calendar, */*;q=0.5', 'user-agent': 'CFO-calendar-sync/1.0' },
        });
        if (res.status >= 300 && res.status < 400) {
            const next = res.headers.get('location');
            if (!next) throw new SyncError('The calendar link redirected nowhere.');
            url = new URL(next, url);
            if (url.protocol !== 'https:' || !hostAllowed(url.hostname)) throw new SyncError('The calendar link redirected somewhere unexpected.');
            continue;
        }
        if (res.status === 404 || res.status === 403 || res.status === 401) {
            throw new SyncError('That link no longer works. It may have been turned off or replaced; paste a fresh one.');
        }
        if (!res.ok) throw new SyncError(`The calendar site answered with an error (${res.status}). We'll try again tomorrow.`);
        if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new SyncError('That calendar is too big to sync (over 5 MB).');
        const text = await res.text();
        if (text.length > MAX_BYTES) throw new SyncError('That calendar is too big to sync (over 5 MB).');
        if (!text.includes('BEGIN:VCALENDAR')) throw new SyncError("That link didn't return a calendar. Check it's the iCal/ICS link, not the web page.");
        return text;
    }
    throw new SyncError('The calendar link redirected too many times.');
}

/** A sync failure we can show the member as is. */
export class SyncError extends Error {}

// ---------------------------------------------------------------------------
// Sync one connection (service role). Never throws; records the outcome.
// ---------------------------------------------------------------------------
export async function syncConnection(conn: Pick<CalendarConnection, 'id' | 'provider' | 'encrypted_secret'>): Promise<{ ok: true; blocks: number } | { ok: false; error: string }> {
    const admin = createServiceSupabase();
    try {
        let blocks: Block[];
        if (conn.provider === 'ics') {
            const link = normalizeCalendarLink(decryptSecret(conn.encrypted_secret));
            if ('error' in link) throw new SyncError(link.error);
            blocks = busyBlocksFromIcs(await fetchIcs(link.url));
        } else {
            const r = await oauthBusyBlocks(conn.provider, decryptSecret(conn.encrypted_secret));
            blocks = r.blocks;
            // Microsoft rotates refresh tokens; keep the newest one.
            if (r.refreshToken) {
                await admin.from('calendar_connections').update({ encrypted_secret: encryptSecret(r.refreshToken) }).eq('id', conn.id);
            }
        }
        const { data, error } = await admin.rpc('replace_busy_blocks', { p_connection: conn.id, p_blocks: blocks as unknown as Json });
        if (error) throw new Error(error.message);
        return { ok: true, blocks: data ?? blocks.length };
    } catch (e) {
        const message =
            e instanceof SyncError || e instanceof OAuthSyncError
                ? e.message
                : e instanceof Error && e.name === 'TimeoutError'
                  ? 'The calendar site took too long to answer. We’ll try again tomorrow.'
                  : 'Something went wrong reading that calendar. We’ll try again tomorrow.';
        if (!(e instanceof SyncError || e instanceof OAuthSyncError)) console.error('[calendar-sync]', conn.id, e);
        await admin.from('calendar_connections').update({ last_error: message }).eq('id', conn.id);
        return { ok: false, error: message };
    }
}

/** Daily cron: every enabled connection, a few at a time. */
export async function syncAll(): Promise<{ total: number; ok: number; failed: number }> {
    const admin = createServiceSupabase();
    const { data, error } = await admin.from('calendar_connections').select('id, provider, encrypted_secret').eq('enabled', true);
    if (error) throw new Error(error.message);
    const queue = [...(data ?? [])];
    let ok = 0;
    let failed = 0;
    await Promise.all(
        Array.from({ length: 4 }, async () => {
            for (let c = queue.shift(); c; c = queue.shift()) {
                if ((await syncConnection(c)).ok) ok++;
                else failed++;
            }
        }),
    );
    return { total: data?.length ?? 0, ok, failed };
}
