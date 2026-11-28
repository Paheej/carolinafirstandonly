export default async function ({ q, check }) {
    const eds = (await q(`select e.name from game_editions e join game_systems s on s.id=e.system_id where s.slug='warhammer-40k' order by e.display_order`)).map((r) => r.name);
    check('40K editions are 3rd and Current', eds.join('|') === '3rd Edition|Current Edition', eds);
    const sys = (await q(`select name from game_systems order by display_order`)).map((r) => r.name);
    check('40K-family systems first, in order', sys.slice(0, 3).join('|') === 'Warhammer 40k|Net Epic Armageddon|Battlefleet Gothic', sys);
    check('Epic has no editions', (await q(`select count(*)::int n from game_editions e join game_systems s on s.id=e.system_id where s.slug='net-epic-armageddon'`))[0].n === 0);
    check('BFG uses an allowed icon', (await q(`select icon from game_systems where slug='battlefleet-gothic'`))[0]?.icon === 'Rocket');
}
