import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import type {
    Season,
    ArchiveEvent,
    Recap,
} from '@cfo/database/types';

/**
 * Server-side data access for the public archive routes. Centralised here
 * (instead of inline in route files) so RLS-relevant queries are easy to
 * audit and the shape is consistent.
 */

export async function getSeasons(): Promise<Season[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('seasons')
        .select('*')
        .order('display_order', { ascending: true })
        .order('starts_on', { ascending: false, nullsFirst: false });
    return data ?? [];
}

export async function getArchiveEvents(): Promise<ArchiveEvent[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('archive_events')
        .select('*')
        .order('display_order', { ascending: true })
        .order('event_date', { ascending: false, nullsFirst: false });
    return data ?? [];
}

export async function getSeasonBySlug(slug: string): Promise<Season | null> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('seasons')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
    return data;
}

export async function getArchiveEventBySlug(
    slug: string,
): Promise<ArchiveEvent | null> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('archive_events')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
    return data;
}

export async function getPublishedRecapsForSeason(
    seasonId: string,
): Promise<Recap[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('recaps')
        .select('*')
        .eq('season_id', seasonId)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false });
    return data ?? [];
}

export async function getPublishedRecapsForEvent(
    eventId: string,
): Promise<Recap[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('recaps')
        .select('*')
        .eq('archive_event_id', eventId)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false });
    return data ?? [];
}

export async function getRecapBySlug(slug: string): Promise<Recap | null> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('recaps')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
    return data;
}

export interface RecapTargetSummary {
    seasons: Pick<Season, 'id' | 'slug' | 'name'>[];
    events: Pick<ArchiveEvent, 'id' | 'slug' | 'name'>[];
}

export async function getRecapTargets(): Promise<RecapTargetSummary> {
    const supabase = createServerSupabase(await cookies());
    const [{ data: seasons }, { data: events }] = await Promise.all([
        supabase
            .from('seasons')
            .select('id, slug, name')
            .order('display_order', { ascending: true }),
        supabase
            .from('archive_events')
            .select('id, slug, name')
            .order('display_order', { ascending: true }),
    ]);
    return {
        seasons: seasons ?? [],
        events: events ?? [],
    };
}
