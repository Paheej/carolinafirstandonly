export default async function ({ q, check }) {
    // 0017's regex, on a sample shaped like the broken Season II markdown.
    const sample = 'x\n\n[\n\n![](https://ik.imagekit.io/a/image-7.jpg)\n\n](S2%20-%20Player%20Hub%20Greensboro.html)\n\n### Hub';
    const out = (await q(`select regexp_replace($1, '\\[\\s+(!\\[[^\\]]*\\]\\([^)]*\\))\\s+\\]\\(', '[\\1](', 'g') r`, [sample]))[0].r;
    check('image-links are joined back together', out.includes('[![](https://ik.imagekit.io/a/image-7.jpg)](S2%20-%20Player%20Hub%20Greensboro.html)'), out);
    const left = (await q(`select count(*)::int n from seasons where description_md ~ '\\]\\([^)/:]*\\.html\\)'`))[0].n;
    check('no .html links left in seasons', left === 0, left);

    const ow = (await q(`select s.status, s.game_system,
        (select count(*)::int from archive_pages p where p.season_id = s.id) pages,
        (select count(*)::int from recaps r where r.season_id = s.id) recaps
        from seasons s where s.slug = 'old-world-campaign'`))[0];
    check('Old World campaign: completed, Fantasy, 6 pages, 9 recaps', ow?.status === 'completed' && ow.game_system === 'Warhammer Fantasy' && ow.pages === 6 && ow.recaps === 9, ow);
    const stray = (await q(`select count(*)::int n from recaps where slug like 'ow-%' and body_md ~ '\\]\\([^)/:]*\\.html\\)'`))[0].n;
    check('Old World recaps have no .html links', stray === 0, stray);
}
