import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import type { CalendarConnection } from '@cfo/database/types';

export type MyCalendar = Omit<CalendarConnection, 'encrypted_secret' | 'user_id'>;

/** The signed-in member's calendar connections (RLS: own rows only). Never selects the secret. */
export async function getMyCalendars(): Promise<MyCalendar[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('calendar_connections')
        .select('id, provider, label, account, enabled, last_synced_at, last_error, block_count, created_at')
        .order('created_at');
    return data ?? [];
}
