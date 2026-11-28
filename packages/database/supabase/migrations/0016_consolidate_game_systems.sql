-- ============================================================================
-- 0016_consolidate_game_systems.sql
--
-- The owner doesn't want a separate label for every 40K edition. The 40K-family
-- choices are now:
--   Warhammer 40k        3rd Edition | Current Edition   (9th, 10th, 11th... -> Current)
--   Net Epic Armageddon  (was "Epic 40k"; no editions)
--   Battlefleet Gothic   (new; no editions)
-- Other systems (Fantasy, LotR, WFRP, D&D) are unchanged.
-- Names are stored as text on seasons/archive_events and in groups.systems /
-- profiles.preferred_systems, so those are rewritten too.
-- ============================================================================

-- 40K: keep 3rd, fold everything else into "Current Edition".
insert into public.game_editions (system_id, slug, name, display_order)
select id, 'current', 'Current Edition', 2 from public.game_systems where slug = 'warhammer-40k'
on conflict (system_id, slug) do nothing;

update public.seasons set game_edition = 'Current Edition'
 where game_system = 'Warhammer 40k' and game_edition is not null and game_edition <> '3rd Edition';
update public.archive_events set game_edition = 'Current Edition'
 where game_system = 'Warhammer 40k' and game_edition is not null and game_edition <> '3rd Edition';

update public.game_editions set display_order = 1
 where slug = '3rd-edition' and system_id = (select id from public.game_systems where slug = 'warhammer-40k');
delete from public.game_editions
 where system_id = (select id from public.game_systems where slug = 'warhammer-40k')
   and slug not in ('3rd-edition', 'current');

-- Epic 40k -> Net Epic Armageddon, no editions.
update public.seasons set game_system = 'Net Epic Armageddon', game_edition = null where game_system = 'Epic 40k';
update public.archive_events set game_system = 'Net Epic Armageddon', game_edition = null where game_system = 'Epic 40k';
update public.groups set systems = array_replace(systems, 'Epic 40k', 'Net Epic Armageddon') where 'Epic 40k' = any(systems);
update public.profiles set preferred_systems = array_replace(preferred_systems, 'Epic 40k', 'Net Epic Armageddon')
 where 'Epic 40k' = any(preferred_systems);
delete from public.game_editions where system_id = (select id from public.game_systems where slug = 'epic-40k');
update public.game_systems set slug = 'net-epic-armageddon', name = 'Net Epic Armageddon', icon = 'Crosshair'
 where slug = 'epic-40k';

-- Battlefleet Gothic, right after the other 40K-universe games.
insert into public.game_systems (slug, name, icon, display_order)
select 'battlefleet-gothic', 'Battlefleet Gothic', 'Rocket', 3
where not exists (select 1 from public.game_systems where slug = 'battlefleet-gothic');

update public.game_systems set display_order = case slug
    when 'warhammer-40k' then 1
    when 'net-epic-armageddon' then 2
    when 'battlefleet-gothic' then 3
    when 'warhammer-fantasy' then 4
    when 'lord-of-the-rings' then 5
    when 'warhammer-fantasy-rpg' then 6
    when 'dungeons-and-dragons' then 7
    else display_order end;

-- Junk "test" edition added by hand under D&D (2026-06-24); nothing uses it.
delete from public.game_editions
 where slug = 'test' and system_id = (select id from public.game_systems where slug = 'dungeons-and-dragons')
   and not exists (select 1 from public.seasons where game_edition = 'test')
   and not exists (select 1 from public.archive_events where game_edition = 'test');
