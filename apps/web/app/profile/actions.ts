'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@cfo/database/server';

function back(kind: 'notice' | 'error', message: string): never {
    redirect(`/profile/settings?${kind}=${encodeURIComponent(message)}`);
}

export async function updateProfile(fd: FormData) {
    const supabase = createServerSupabase(await cookies());
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?next=/profile/settings');

    const str = (k: string) => {
        const v = fd.get(k);
        return typeof v === 'string' ? v.trim() : '';
    };
    const username = str('username').toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        back('error', 'Usernames are 3 to 30 characters: lowercase letters, numbers and underscores.');
    }
    const { error } = await supabase
        .from('profiles')
        .update({
            username,
            display_name: str('display_name') || null,
            bio: str('bio') || null,
            preferred_systems: fd.getAll('systems').filter((v): v is string => typeof v === 'string'),
        })
        .eq('id', user.id);
    if (error) back('error', error.code === '23505' ? `@${username} is taken.` : error.message);
    revalidatePath('/', 'layout');
    back('notice', 'Profile saved.');
}
