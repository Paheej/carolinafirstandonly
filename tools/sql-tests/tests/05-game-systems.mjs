export default async function ({ q, check }) {
    const eds = (await q(`select e.name from game_editions e join game_systems s on s.id=e.system_id where s.slug='warhammer-40k' order by e.display_order`)).map((r) => r.name);
    check('40K editions are 1st through 11th again (0020)', eds.length === 11 && eds[0] === '1st Edition' && eds[10] === '11th Edition' && !eds.includes('Current Edition'), eds);
    const sys = (await q(`select name from game_systems order by display_order`)).map((r) => r.name);
    check('40K-family systems first, in order', sys.slice(0, 3).join('|') === 'Warhammer 40k|Net Epic Armageddon|Battlefleet Gothic', sys);
    check('Epic has no editions', (await q(`select count(*)::int n from game_editions e join game_systems s on s.id=e.system_id where s.slug='net-epic-armageddon'`))[0].n === 0);
    check('BFG uses an allowed icon', (await q(`select icon from game_systems where slug='battlefleet-gothic'`))[0]?.icon === 'Rocket');

    const bs = (await q(`select game_system, game_edition, games from seasons where slug='burning-star'`))[0];
    const labels = (bs?.games ?? []).map((g) => `${g.system}${g.edition ? ' ' + g.edition : ''}`).join('|');
    check('Burning Star lists all four games, 11th first', labels === 'Warhammer 40k 11th Edition|Warhammer 40k 3rd Edition|Net Epic Armageddon|Battlefleet Gothic' && bs.game_edition === '11th Edition', labels);
    const dr = (await q(`select game_system, game_edition from archive_events where slug='drafted'`))[0];
    check('Drafted! is Warhammer Fantasy 5th Edition', dr?.game_system === 'Warhammer Fantasy' && dr.game_edition === '5th Edition', dr);
    const missing = (await q(`select count(*)::int n from seasons where game_system is not null and games = '[]'`))[0].n;
    check('every season with a game has a games list', missing === 0, missing);
}
