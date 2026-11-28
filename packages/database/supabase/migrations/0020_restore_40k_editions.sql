-- ============================================================================
-- 0020_restore_40k_editions.sql
--
-- The owner reversed the 40K part of 0016: the numbered editions come back
-- (1st through 11th) and each season/event gets its real edition again, as
-- before 0016: Seasons I-III were 9th, Burning Star and Showdown at Snyder's
-- were 10th. "Current Edition" goes away. Net Epic Armageddon and Battlefleet
-- Gothic from 0016 stay.
-- ============================================================================

insert into public.game_editions (system_id, slug, name, display_order)
select s.id, e.slug, e.name, e.ord
from public.game_systems s
cross join (values
    ('1st-edition', '1st Edition', 1),
    ('2nd-edition', '2nd Edition', 2),
    ('3rd-edition', '3rd Edition', 3),
    ('4th-edition', '4th Edition', 4),
    ('5th-edition', '5th Edition', 5),
    ('6th-edition', '6th Edition', 6),
    ('7th-edition', '7th Edition', 7),
    ('8th-edition', '8th Edition', 8),
    ('9th-edition', '9th Edition', 9),
    ('10th-edition', '10th Edition', 10),
    ('11th-edition', '11th Edition', 11)
) as e(slug, name, ord)
where s.slug = 'warhammer-40k'
on conflict (system_id, slug) do update set name = excluded.name, display_order = excluded.display_order;

update public.seasons set game_edition = '9th Edition'
 where slug in ('season-1', 'season-2', 'season-3') and game_system = 'Warhammer 40k';
update public.seasons set game_edition = '10th Edition'
 where slug = 'burning-star' and game_system = 'Warhammer 40k';
update public.archive_events set game_edition = '10th Edition'
 where slug = 'showdown-at-snyders' and game_system = 'Warhammer 40k';

-- Anything else still on the placeholder gets no edition rather than a wrong one.
update public.seasons set game_edition = null where game_system = 'Warhammer 40k' and game_edition = 'Current Edition';
update public.archive_events set game_edition = null where game_system = 'Warhammer 40k' and game_edition = 'Current Edition';

delete from public.game_editions
 where slug = 'current' and system_id = (select id from public.game_systems where slug = 'warhammer-40k');
