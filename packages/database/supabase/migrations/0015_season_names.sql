-- 0015_season_names.sql — consistent 40K season names ("40k - Season I").
-- The year is shown separately, so it no longer goes in the name.
update public.seasons set name = '40k - Season I'   where slug = 'season-1';
update public.seasons set name = '40k - Season II'  where slug = 'season-2';
update public.seasons set name = '40k - Season III' where slug = 'season-3';
