-- ============================================================================
-- 0010_current_campaigns.sql
--
-- Seasons are the club's campaigns. This adds:
--   - status: 'active' for campaigns being played now, 'completed' otherwise.
--     The home page features active campaigns instead of guessing from the
--     newest archive entry (which made Drafted!, an event, look like one).
--   - external_url: where a campaign is tracked when it lives elsewhere,
--     e.g. the Campaign Chronicle at campaign-chronicle.app.
-- And seeds the two campaigns running now. Admins can fill in dates and
-- write-ups from /archive/seasons/<slug>/edit.
-- ============================================================================

alter table public.seasons
    add column if not exists status text not null default 'completed'
        check (status in ('active', 'completed')),
    add column if not exists external_url text;

create index if not exists seasons_active_idx
    on public.seasons (status) where status = 'active';

insert into public.seasons
    (slug, name, year, status, external_url, game_system, game_edition, display_order, description_md)
values
    (
        'burning-star',
        'Campaign of the Burning Star',
        2026,
        'active',
        'https://campaign-chronicle.app',
        'Warhammer 40k',
        '10th Edition',
        4,
        'Our current narrative campaign, tracked on the Campaign Chronicle. Log battles, painted units, lore and reading there; factions earn glory and take planets on the orbital map.'
    ),
    (
        'curse-of-strahd',
        'Curse of Strahd',
        2026,
        'active',
        null,
        'Dungeons and Dragons',
        '5th Edition',
        5,
        'Our D&D campaign through the mists of Barovia.'
    )
on conflict (slug) do nothing;
