import { updateSupabaseSession } from '@cfo/database/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    return updateSupabaseSession(request);
}

export const config = {
    matcher: [
        // Run on all routes except static files and Next internals.
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
