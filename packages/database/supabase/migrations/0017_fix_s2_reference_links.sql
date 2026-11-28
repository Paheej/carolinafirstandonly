-- ============================================================================
-- 0017_fix_s2_reference_links.sql
--
-- The Google Sites import left five image-links on Season II broken: the
-- link text (an image) was split over blank lines and the target was still
-- the old "S2 - Player Hub Greensboro.html" file, so the page showed stray
-- "[" and "](S2%20-...html)" text. Join each back into [![](img)](/archive/pages/<slug>).
-- ============================================================================

-- 1. "[\n\n![](img)\n\n](" -> "[![](img)]("
update public.seasons
   set description_md = regexp_replace(description_md, '\[\s+(!\[[^\]]*\]\([^)]*\))\s+\]\(', '[\1](', 'g')
 where slug = 'season-2';

-- 2. Old page files -> archive reference pages.
update public.seasons set description_md =
    replace(replace(replace(replace(replace(description_md,
        '](S2%20-%20Player%20Hub%20Greensboro.html)',  '](/archive/pages/s2-player-hub-greensboro)'),
        '](S2%20-%20Player%20Hub%20Charlotte.html)',   '](/archive/pages/s2-player-hub-charlotte)'),
        '](S2%20-%20Player%20Faction%20Defender.html)', '](/archive/pages/s2-player-faction-defender)'),
        '](S2%20-%20Player%20Faction%20Attacker.html)', '](/archive/pages/s2-player-faction-attacker)'),
        '](S2%20-%20Player%20Faction%20Raider.html)',   '](/archive/pages/s2-player-faction-raider)')
 where slug = 'season-2';
