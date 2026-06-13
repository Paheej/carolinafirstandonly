-- ============================================================================
-- 0007_game_system_and_page_links.sql
--
-- - Adds game_system / game_edition to seasons and archive_events so
--   the archive can show "40K · 9th Ed" style pills instead of generic
--   Season / Special Event labels.
-- - Adds season_id to archive_pages so reference docs can be grouped
--   under their season page.
-- - Backfills the three migrated seasons with 40K + 9th Edition, the
--   six s2-reference pages with season-2's id, and a couple of sane
--   defaults on the special events.
-- ============================================================================

alter table public.seasons
    add column if not exists game_system text,
    add column if not exists game_edition text;

alter table public.archive_events
    add column if not exists game_system text,
    add column if not exists game_edition text;

alter table public.archive_pages
    add column if not exists season_id uuid references public.seasons(id) on delete set null;

create index if not exists archive_pages_season_idx
    on public.archive_pages (season_id, display_order);

-- ----------------------------------------------------------------------------
-- Backfill
-- ----------------------------------------------------------------------------

-- All three 40K seasons.
update public.seasons
   set game_system = '40K',
       game_edition = '9th Edition'
 where slug in ('season-1', 'season-2', 'season-3');

-- Showdown at Snyder's (Dec 2023): 40K, 10th Edition launched June 2023.
update public.archive_events
   set game_system = '40K',
       game_edition = '10th Edition'
 where slug = 'showdown-at-snyders';

-- Old Alliances (July 2024) was a Warhammer Old World Tears-of-Isha event.
update public.archive_events
   set game_system = 'Warhammer',
       game_edition = 'Old World'
 where slug = 'old-alliances';

-- Link the S2 reference pages to season-2.
update public.archive_pages p
   set season_id = s.id
  from public.seasons s
 where s.slug = 'season-2'
   and p.category = 's2-reference';
