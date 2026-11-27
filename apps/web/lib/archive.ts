import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import type {
    Season,
    ArchiveEvent,
    Recap,
    ArchivePage,
    GameSystem,
    GameEdition,
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

export async function getArchivePages(): Promise<ArchivePage[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('archive_pages')
        .select('*')
        .order('category', { ascending: true, nullsFirst: false })
        .order('display_order', { ascending: true });
    return data ?? [];
}

export async function getGameSystems(): Promise<GameSystem[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('game_systems')
        .select('*')
        .order('display_order', { ascending: true });
    return data ?? [];
}

export async function getGameEditions(): Promise<GameEdition[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('game_editions')
        .select('*')
        .order('display_order', { ascending: true });
    return data ?? [];
}

/**
 * Returns a map from the display name stored in seasons/archive_events
 * (e.g. "40K") to the lucide icon name (e.g. "Skull"). Used so the public
 * archive routes can render the SystemPill with its icon without a join.
 */
export async function getSystemIconMap(): Promise<Record<string, string>> {
    const systems = await getGameSystems();
    return Object.fromEntries(systems.map((s) => [s.name, s.icon]));
}

export async function getArchivePagesForSeason(
    seasonId: string,
): Promise<ArchivePage[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('archive_pages')
        .select('*')
        .eq('season_id', seasonId)
        .order('display_order', { ascending: true });
    return data ?? [];
}

export async function getArchivePageBySlug(
    slug: string,
): Promise<ArchivePage | null> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('archive_pages')
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

/** Latest published recaps that have a real write-up (skips placeholder stubs). */
export async function getLatestRecaps(limit = 4): Promise<Recap[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('recaps')
        .select('*')
        .not('published_at', 'is', null)
        .not('body_md', 'ilike', '_This page existed as a placeholder%')
        .order('published_at', { ascending: false })
        .limit(limit);
    return data ?? [];
}

/** Campaigns being played now, featured on the home page. */
export async function getActiveCampaigns(): Promise<Season[]> {
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase
        .from('seasons')
        .select('*')
        .eq('status', 'active')
        .order('display_order', { ascending: true });
    return data ?? [];
}

export interface TimelineEntry {
    slug: string;
    name: string;
    href: string;
    /** Display: ISO date when known, else year. */
    date: string | null;
    year: number | null;
    active: boolean;
    game_system: string | null;
    game_edition: string | null;
}

const sortKey = (c: TimelineEntry) => c.date ?? (c.year ? `${c.year}-00-00` : '0000');
const newestFirst = (a: TimelineEntry, b: TimelineEntry) =>
    Number(b.active) - Number(a.active) || sortKey(b).localeCompare(sortKey(a)) || b.name.localeCompare(a.name);

/** Campaigns (seasons), running ones first, then newest first. */
export async function getCampaignTimeline(): Promise<TimelineEntry[]> {
    const seasons = await getSeasons();
    return seasons
        .map((s) => ({
            slug: s.slug,
            name: s.name,
            href: `/archive/seasons/${s.slug}`,
            date: s.starts_on,
            year: s.year ?? (s.starts_on ? new Date(s.starts_on).getUTCFullYear() : null),
            active: s.status === 'active',
            game_system: s.game_system,
            game_edition: s.game_edition,
        }))
        .sort(newestFirst);
}

/** Special events (one-off days like Drafted!), newest first. */
export async function getEventTimeline(): Promise<TimelineEntry[]> {
    const events = await getArchiveEvents();
    return events
        .map((e) => ({
            slug: e.slug,
            name: e.name,
            href: `/archive/events/${e.slug}`,
            date: e.event_date,
            year: e.event_date ? new Date(e.event_date).getUTCFullYear() : null,
            active: false,
            game_system: e.game_system,
            game_edition: e.game_edition,
        }))
        .sort(newestFirst);
}
