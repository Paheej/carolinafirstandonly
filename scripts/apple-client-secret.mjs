#!/usr/bin/env node
/**
 * Generates the "Secret Key" that Supabase needs for Sign in with Apple.
 *
 * Apple doesn't issue a static client secret. Instead you sign a short JWT
 * with the .p8 key from the Apple Developer portal. Apple caps its lifetime
 * at 6 months, so this must be re-run and pasted into Supabase before it
 * expires (the script prints the expiry date).
 *
 * Usage:
 *   node scripts/apple-client-secret.mjs \
 *     --team <TEAM_ID> --key-id <KEY_ID> --client-id <SERVICES_ID> --p8 <path/to/AuthKey_XXXX.p8>
 *
 * Or set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID and APPLE_P8_PATH.
 * Never commit the .p8 file.
 */
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';

function arg(name, envName) {
    const i = process.argv.indexOf(`--${name}`);
    const v = i > -1 ? process.argv[i + 1] : process.env[envName];
    if (!v) {
        console.error(`Missing --${name} (or ${envName}).`);
        process.exit(1);
    }
    return v;
}

const teamId = arg('team', 'APPLE_TEAM_ID');
const keyId = arg('key-id', 'APPLE_KEY_ID');
const clientId = arg('client-id', 'APPLE_CLIENT_ID');
const p8Path = arg('p8', 'APPLE_P8_PATH');

const MAX_LIFETIME = 15777000; // seconds; Apple's 6-month limit
const now = Math.floor(Date.now() / 1000);
const exp = now + MAX_LIFETIME - 3600; // an hour of slack

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const header = b64url({ alg: 'ES256', kid: keyId, typ: 'JWT' });
const payload = b64url({
    iss: teamId,
    iat: now,
    exp,
    aud: 'https://appleid.apple.com',
    sub: clientId,
});

const key = createPrivateKey(readFileSync(p8Path, 'utf8'));
const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: 'ieee-p1363', // JWT wants raw r||s, not DER
}).toString('base64url');

console.log(`${header}.${payload}.${signature}`);
console.error(`\nExpires ${new Date(exp * 1000).toDateString()}. Regenerate and paste into Supabase before then.`);
