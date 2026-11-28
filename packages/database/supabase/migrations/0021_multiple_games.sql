-- ============================================================================
-- 0021_multiple_games.sql
--
-- A campaign can span several games: Burning Star is 40K 11th and 3rd
-- Edition, Net Epic Armageddon and Battlefleet Gothic. `games` holds the full
-- list as [{"system": "...", "edition": "..."|null}], first entry = the main
-- game. game_system / game_edition stay as a copy of that first entry, so
-- existing filters and the home page board keep working.
-- Also: Drafted! was Warhammer Fantasy 5th Edition.
-- ============================================================================

alter table public.seasons add column if not exists games jsonb not null default '[]'
    check (jsonb_typeof(games) = 'array');
alter table public.archive_events add column if not exists games jsonb not null default '[]'
    check (jsonb_typeof(games) = 'array');

-- Backfill from the single fields.
update public.seasons set games = jsonb_build_array(jsonb_build_object('system', game_system, 'edition', game_edition))
 where game_system is not null and games = '[]';
update public.archive_events set games = jsonb_build_array(jsonb_build_object('system', game_system, 'edition', game_edition))
 where game_system is not null and games = '[]';

update public.seasons set
    game_system = 'Warhammer 40k',
    game_edition = '11th Edition',
    games = '[{"system": "Warhammer 40k", "edition": "11th Edition"},
              {"system": "Warhammer 40k", "edition": "3rd Edition"},
              {"system": "Net Epic Armageddon", "edition": null},
              {"system": "Battlefleet Gothic", "edition": null}]'
 where slug = 'burning-star';

update public.archive_events set
    game_system = 'Warhammer Fantasy',
    game_edition = '5th Edition',
    games = '[{"system": "Warhammer Fantasy", "edition": "5th Edition"}]'
 where slug = 'drafted';
