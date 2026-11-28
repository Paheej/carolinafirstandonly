export default async function ({ q, check }) {
    const stale = (await q(`select count(*)::int n from recaps r
                            left join seasons s on s.id = r.season_id
                            left join archive_events e on e.id = r.archive_event_id
                            where r.published_at >= '2026-01-01' and coalesce(e.event_date < '2026-01-01', s.year < 2026)`))[0].n;
    check('no pre-2026 recap keeps its 2026 import date (0023)', stale === 0, stale);

    const s2 = await q(`select distinct extract(year from r.published_at at time zone 'America/New_York')::int y
                        from recaps r join seasons s on s.id = r.season_id where s.slug = 'season-2'`);
    check('Season II recaps are dated 2021', s2.length > 0 && s2.every((r) => r.y === 2021), s2);

    // Home page order: newest real recaps first (placeholders are skipped there).
    const latest = (await q(`select slug from recaps where published_at is not null
                             and body_md not ilike '_This page existed as a placeholder%'
                             order by published_at desc limit 4`)).map((r) => r.slug);
    check('home Recaps leads with the Old World recaps', latest.length === 4 && latest.every((s) => s.startsWith('ow-')), latest);
}
