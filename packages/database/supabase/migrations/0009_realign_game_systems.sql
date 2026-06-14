-- ============================================================================
-- 0009_realign_game_systems.sql
--
-- Reshape game_systems / game_editions to the canonical list we actually
-- play. Drops Horus Heresy and Age of Sigmar (not played here), renames
-- existing systems to their full display names, and adds Epic 40k and
-- Lord of the Rings. Editions are seeded out to the limits the spec
-- called out (40k 1st–11th, Epic 1st–4th + NetEpic, Fantasy 1st–8th +
-- Old World, LotR 1st–4th, WFRP 1st–4th, D&D 1st–5th).
--
-- seasons / archive_events store game_system + game_edition as free
-- text, so existing rows are migrated to the new display names before
-- the systems table is rebuilt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Migrate existing season / event rows to the new display names.
-- ----------------------------------------------------------------------------

update public.seasons
   set game_system = 'Warhammer 40k'
 where game_system = '40K';

update public.archive_events
   set game_system = 'Warhammer 40k'
 where game_system = '40K';

-- Old Alliances was tagged system='Old World' / edition=null; under the
-- new structure Old World is an *edition* of Warhammer Fantasy.
update public.archive_events
   set game_system = 'Warhammer Fantasy',
       game_edition = 'Old World'
 where slug = 'old-alliances';

-- ----------------------------------------------------------------------------
-- 2. Rebuild the game_systems table from scratch.
--    Editions cascade-delete via the FK in 0008.
-- ----------------------------------------------------------------------------

delete from public.game_systems;

insert into public.game_systems (slug, name, icon, display_order) values
    ('warhammer-40k',         'Warhammer 40k',         'Skull',     1),
    ('epic-40k',              'Epic 40k',              'Crosshair', 2),
    ('warhammer-fantasy',     'Warhammer Fantasy',     'Castle',    3),
    ('lord-of-the-rings',     'Lord of the Rings',     'Mountain',  4),
    ('warhammer-fantasy-rpg', 'Warhammer Fantasy RPG', 'Scroll',    5),
    ('dungeons-and-dragons',  'Dungeons and Dragons',  'Dices',     6);

-- ----------------------------------------------------------------------------
-- 3. Seed editions.
-- ----------------------------------------------------------------------------

-- Warhammer 40k — 1st through 11th
insert into public.game_editions (system_id, slug, name, display_order)
select s.id, ed.slug, ed.name, ed.ord
  from public.game_systems s
  join (values
      ('1st-edition',  '1st Edition',  1),
      ('2nd-edition',  '2nd Edition',  2),
      ('3rd-edition',  '3rd Edition',  3),
      ('4th-edition',  '4th Edition',  4),
      ('5th-edition',  '5th Edition',  5),
      ('6th-edition',  '6th Edition',  6),
      ('7th-edition',  '7th Edition',  7),
      ('8th-edition',  '8th Edition',  8),
      ('9th-edition',  '9th Edition',  9),
      ('10th-edition', '10th Edition', 10),
      ('11th-edition', '11th Edition', 11)
  ) as ed(slug, name, ord) on true
 where s.slug = 'warhammer-40k';

-- Epic 40k — 1st through 4th, plus NetEpic
insert into public.game_editions (system_id, slug, name, display_order)
select s.id, ed.slug, ed.name, ed.ord
  from public.game_systems s
  join (values
      ('1st-edition', '1st Edition', 1),
      ('2nd-edition', '2nd Edition', 2),
      ('3rd-edition', '3rd Edition', 3),
      ('4th-edition', '4th Edition', 4),
      ('netepic',     'NetEpic',     5)
  ) as ed(slug, name, ord) on true
 where s.slug = 'epic-40k';

-- Warhammer Fantasy — 1st through 8th, plus Old World
insert into public.game_editions (system_id, slug, name, display_order)
select s.id, ed.slug, ed.name, ed.ord
  from public.game_systems s
  join (values
      ('1st-edition', '1st Edition', 1),
      ('2nd-edition', '2nd Edition', 2),
      ('3rd-edition', '3rd Edition', 3),
      ('4th-edition', '4th Edition', 4),
      ('5th-edition', '5th Edition', 5),
      ('6th-edition', '6th Edition', 6),
      ('7th-edition', '7th Edition', 7),
      ('8th-edition', '8th Edition', 8),
      ('old-world',   'Old World',   9)
  ) as ed(slug, name, ord) on true
 where s.slug = 'warhammer-fantasy';

-- Lord of the Rings — 1st through 4th
insert into public.game_editions (system_id, slug, name, display_order)
select s.id, ed.slug, ed.name, ed.ord
  from public.game_systems s
  join (values
      ('1st-edition', '1st Edition', 1),
      ('2nd-edition', '2nd Edition', 2),
      ('3rd-edition', '3rd Edition', 3),
      ('4th-edition', '4th Edition', 4)
  ) as ed(slug, name, ord) on true
 where s.slug = 'lord-of-the-rings';

-- Warhammer Fantasy RPG — 1st through 4th
insert into public.game_editions (system_id, slug, name, display_order)
select s.id, ed.slug, ed.name, ed.ord
  from public.game_systems s
  join (values
      ('1st-edition', '1st Edition', 1),
      ('2nd-edition', '2nd Edition', 2),
      ('3rd-edition', '3rd Edition', 3),
      ('4th-edition', '4th Edition', 4)
  ) as ed(slug, name, ord) on true
 where s.slug = 'warhammer-fantasy-rpg';

-- Dungeons and Dragons — 1st through 5th
insert into public.game_editions (system_id, slug, name, display_order)
select s.id, ed.slug, ed.name, ed.ord
  from public.game_systems s
  join (values
      ('1st-edition', '1st Edition', 1),
      ('2nd-edition', '2nd Edition', 2),
      ('3rd-edition', '3rd Edition', 3),
      ('4th-edition', '4th Edition', 4),
      ('5th-edition', '5th Edition', 5)
  ) as ed(slug, name, ord) on true
 where s.slug = 'dungeons-and-dragons';
