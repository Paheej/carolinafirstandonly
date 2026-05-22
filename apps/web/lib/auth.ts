import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import type { Profile } from '@cfo/database/types';

export interface CurrentUser {
    id: string;
    email: string | null;
    profile: Profile | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    return {
        id: user.id,
        email: user.email ?? null,
        profile: profile ?? null,
    };
}
