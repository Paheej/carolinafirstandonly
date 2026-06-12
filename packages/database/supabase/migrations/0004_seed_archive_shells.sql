-- ============================================================================
-- 0004_seed_archive_shells.sql — Phase 1 placeholder content
-- Inserts shells for the three known 40K seasons and three special events
-- so the public archive routes have something to render before the
-- Playwright scrape is reviewed and ingested.
--
-- Editing later: update the rows directly (admin UI lands in Phase 2/3) or
-- ship a 0005_seed_archive_content.sql with the reviewed JSON output of
-- scripts/migrate-google-site.ts.
-- ============================================================================

insert into public.seasons (slug, name, year, description_md, display_order)
values
    ('season-1', 'Season 1', null,
     '_Season summary will be filled in from the migrated Google Sites content._',
     1),
    ('season-2', 'Season 2', null,
     '_Season summary will be filled in from the migrated Google Sites content._',
     2),
    ('season-3', 'Season 3', null,
     '_Season summary will be filled in from the migrated Google Sites content._',
     3)
on conflict (slug) do nothing;

insert into public.archive_events (slug, name, description_md, display_order)
values
    ('special-event-1', 'Special Event 1',
     '_Event recap will be filled in from the migrated Google Sites content._', 1),
    ('special-event-2', 'Special Event 2',
     '_Event recap will be filled in from the migrated Google Sites content._', 2),
    ('special-event-3', 'Special Event 3',
     '_Event recap will be filled in from the migrated Google Sites content._', 3)
on conflict (slug) do nothing;
