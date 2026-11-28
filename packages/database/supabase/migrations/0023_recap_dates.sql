-- ============================================================================
-- 0023_recap_dates.sql — date imported recaps by when they were played
--
-- The Phase 1 import stamped Season II's pages and the Showdown at Snyder's
-- recap with the import time (June 2026), so the home page's "Recaps" put
-- them ahead of newer ones (the Old World recaps from 2024). The old site has
-- no per-page dates, so each one takes its event's date, or Dec 1 of its
-- season's year. Only recaps of pre-2026 seasons and events that carry a 2026
-- (import-time) date change.
-- ============================================================================

update public.recaps r
set published_at = (e.event_date::timestamp + time '17:00') at time zone 'America/New_York'
from public.archive_events e
where r.archive_event_id = e.id
  and e.event_date < '2026-01-01'
  and r.published_at >= '2026-01-01';

update public.recaps r
set published_at = (make_date(s.year, 12, 1)::timestamp + time '17:00') at time zone 'America/New_York'
from public.seasons s
where r.season_id = s.id
  and r.archive_event_id is null
  and s.year < 2026
  and r.published_at >= '2026-01-01';
