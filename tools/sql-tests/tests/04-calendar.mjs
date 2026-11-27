export default async function ({ as, q, check, U }) {
    const err = (r) => (r && !Array.isArray(r) ? r.error : null);
    const one = (r) => (Array.isArray(r) ? r[0] : undefined);

    // A group of owner + bob + cat. dan is an outsider.
    await as(U.owner, `insert into groups (slug, name, join_policy, created_by) values ('table','Table','open',$1)`, [U.owner]);
    const gid = (await q(`select id from groups where slug='table'`))[0].id;
    await as(U.bob, `select public.join_group($1)`, [gid]);
    await as(U.cat, `select public.join_group($1)`, [gid]);

    const add = (uid, label) =>
        as(uid, `insert into calendar_connections (user_id, label, encrypted_secret) values ($1,$2,'v1.x') returning id`, [uid, label]);
    check('connect your own calendar', one(await add(U.bob, 'iCloud'))?.id);
    check('cannot connect a calendar for someone else', /row-level security/.test(err(await as(U.bob, `insert into calendar_connections (user_id, label, encrypted_secret) values ($1,'x','v1.x')`, [U.cat])) ?? ''));
    for (let i = 0; i < 4; i++) await add(U.bob, `c${i}`);
    check('five calendars at most', /up to 5/.test(err(await add(U.bob, 'six')) ?? ''));
    await q(`delete from calendar_connections where label <> 'iCloud'`);
    const bobConn = (await q(`select id from calendar_connections where user_id=$1`, [U.bob]))[0].id;
    check('others cannot see your connections', (await as(U.cat, `select 1 from calendar_connections`)).length === 0);
    check('cannot hand a connection to someone else', /change owner/.test(err(await as(U.bob, `update calendar_connections set user_id=$1`, [U.cat])) ?? ''));

    check('members cannot write busy blocks directly', /row-level security/.test(err(await as(U.bob, `insert into user_busy_blocks (user_id, connection_id, starts_at, ends_at) values ($1,$2,now(),now()+interval '1 hour')`, [U.bob, bobConn])) ?? ''));
    check('members cannot call replace_busy_blocks', /permission denied/.test(err(await as(U.bob, `select public.replace_busy_blocks($1,'[]')`, [bobConn])) ?? ''));

    // Window: 2026-12-05 13:00-17:00 Eastern (18:00-22:00 UTC).
    const S = '2026-12-05T18:00:00Z';
    const E = '2026-12-05T22:00:00Z';
    // bob: busy 14:00-15:00 Eastern on the 5th only.
    const n = (await q(`select public.replace_busy_blocks($1, $2::jsonb) n`, [bobConn, JSON.stringify([
        { s: '2026-12-05T19:00:00Z', e: '2026-12-05T20:00:00Z' },
        { s: '2026-12-05T21:00:00Z', e: '2026-12-05T20:00:00Z' }, // backwards, dropped
    ])]))[0].n;
    check('replace_busy_blocks stores valid blocks', n === 1, n);
    check('sync marks the connection', (await q(`select block_count, last_synced_at is not null ok from calendar_connections where id=$1`, [bobConn]))[0].ok);
    check('you can see your own busy blocks', (await as(U.bob, `select 1 from user_busy_blocks`)).length === 1);
    check('nobody else sees them', (await as(U.owner, `select 1 from user_busy_blocks`)).length === 0);

    // cat: connected, never busy.
    const catConn = one(await add(U.cat, 'Google')).id;
    await q(`select public.replace_busy_blocks($1, '[]')`, [catConn]);

    const avail = await as(U.owner, `select * from public.group_availability($1,$2,$3,3)`, [gid, S, E]);
    check('availability: 3 days', Array.isArray(avail) && avail.length === 3, avail);
    const d0 = avail[0];
    check('day 0: 1 of 2 connected free, 3 members', d0.members === 3 && d0.connected === 2 && d0.free === 1, d0);
    check('day 1: both free', avail[1].free === 2, avail[1]);
    check('days step in Eastern time', new Date(avail[1].starts_at).toISOString() === '2026-12-06T18:00:00.000Z', avail[1].starts_at);
    check('availability returns counts only', !Object.keys(d0).some((k) => /user|name/.test(k)));
    check('outsiders cannot see availability', /Only group members/.test(err(await as(U.dan, `select * from public.group_availability($1,$2,$3)`, [gid, S, E])) ?? ''));
    check('anon cannot see availability', !!err(await as(null, `select * from public.group_availability($1,$2,$3)`, [gid, S, E])));
    check('window capped at 24 hours', /24 hours/.test(err(await as(U.owner, `select * from public.group_availability($1,$2,$3)`, [gid, S, '2026-12-07T22:00:00Z'])) ?? ''));

    // DST: 2027-03-13 13:00 EST -> next day is 13:00 EDT (17:00 UTC).
    const dst = await as(U.owner, `select starts_at from public.group_availability($1,'2027-03-13T18:00:00Z','2027-03-13T22:00:00Z',2)`, [gid]);
    check('DST: 1 PM stays 1 PM', new Date(dst[1].starts_at).toISOString() === '2027-03-14T17:00:00.000Z', dst);

    await as(U.bob, `update calendar_connections set enabled=false where id=$1`, [bobConn]);
    check('paused calendars are ignored', one(await as(U.owner, `select * from public.group_availability($1,$2,$3)`, [gid, S, E]))?.connected === 1);
    await as(U.bob, `delete from calendar_connections where id=$1`, [bobConn]);
    check('disconnecting deletes the busy blocks', (await q(`select count(*)::int n from user_busy_blocks where user_id=$1`, [U.bob]))[0].n === 0);
}
