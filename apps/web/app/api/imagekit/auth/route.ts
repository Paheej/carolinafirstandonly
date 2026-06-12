import { NextResponse } from 'next/server';
import { randomBytes, createHmac } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Mints a short-lived signature so the browser can upload directly to
 * ImageKit without ever seeing our private key. Auth-gated — only signed-in
 * users get upload tokens; unauthenticated callers get 401.
 *
 * ImageKit's signature algo (v1):
 *   signature = HMAC-SHA1(token + expire, privateKey)
 * https://docs.imagekit.io/api-reference/upload-file-api/client-side-file-upload
 */
export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
    if (!privateKey || !publicKey) {
        return NextResponse.json(
            { error: 'imagekit_not_configured' },
            { status: 500 },
        );
    }

    const token = randomBytes(16).toString('hex');
    // 20 minutes; ImageKit caps at 1h, we use a tighter window.
    const expire = Math.floor(Date.now() / 1000) + 20 * 60;
    const signature = createHmac('sha1', privateKey)
        .update(token + expire)
        .digest('hex');

    return NextResponse.json(
        { signature, expire, token, publicKey },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
