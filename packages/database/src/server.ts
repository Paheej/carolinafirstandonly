import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './types';

interface CookieStore {
    getAll(): Array<{ name: string; value: string }>;
    set(options: { name: string; value: string } & CookieOptions): void;
}

/**
 * Server-side Supabase client bound to a Next.js `cookies()` store.
 * Pass `await cookies()` from a Server Component, Route Handler, or
 * Server Action. In read-only contexts (Server Components), `set` will
 * throw — we catch and ignore; Supabase's session-refresh path tolerates
 * this and `middleware.ts` keeps cookies fresh on each request.
 */
export function createServerSupabase(cookieStore: CookieStore) {
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
                    try {
                        for (const { name, value, options } of cookiesToSet) {
                            cookieStore.set({ name, value, ...options });
                        }
                    } catch {
                        // Server Components can't mutate cookies; ignore.
                    }
                },
            },
        },
    );
}

/**
 * Service-role client. Server-only. Bypasses RLS — use sparingly and
 * never in code that runs in the browser.
 */
export function createServiceSupabase() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key,
        {
            cookies: {
                getAll: () => [],
                setAll: () => {
                    /* service role doesn't touch session cookies */
                },
            },
        },
    );
}
