import { cookies } from 'next/headers';
import { createServerSupabase } from '@cfo/database/server';
import type {
    Season,
    ArchiveEvent,
    Recap,
    ArchivePage,
    GameSystem,
    GameEdition,
    GameRef,
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
    games: GameRef[];
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
            games: gamesOf(s),
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
            games: gamesOf(e),
        }))
        .sort(newestFirst);
}

/** A season's or event's games: the `games` list, or its single game_system/edition for older rows. */
export function gamesOf(row: { games?: GameRef[] | null; game_system: string | null; game_edition: string | null }): GameRef[] {
    if (row.games && row.games.length > 0) return row.games;
    return row.game_system ? [{ system: row.game_system, edition: row.game_edition }] : [];
}

/** "Warhammer 40k 11th and 3rd Edition, Net Epic Armageddon, Battlefleet Gothic" */
export function gamesLabel(games: GameRef[]): string | null {
    if (games.length === 0) return null;
    const bySystem = new Map<string, string[]>();
    for (const g of games) {
        const eds = bySystem.get(g.system) ?? [];
        if (g.edition) eds.push(g.edition);
        bySystem.set(g.system, eds);
    }
    return [...bySystem.entries()]
        .map(([sys, eds]) => {
            if (eds.length === 0) return sys;
            if (eds.length === 1) return `${sys}, ${eds[0]}`;
            // "11th Edition" + "3rd Edition" -> "11th and 3rd Edition"
            const short = eds.map((e) => e.replace(/ Edition$/, ''));
            const allEditions = eds.every((e) => / Edition$/.test(e));
            return `${sys}, ${short.slice(0, -1).join(', ')} and ${short[short.length - 1]}${allEditions ? ' Edition' : ''}`;
        })
        .join('; ');
}
