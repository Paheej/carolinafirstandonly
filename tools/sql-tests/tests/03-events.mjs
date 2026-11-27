export default async function ({ as, q, check, U }) {
    const err = (r) => (r && !Array.isArray(r) ? r.error : null);
    const one = (r) => (Array.isArray(r) ? r[0] : undefined);
    const status = async (uid, eid) => (await q(`select status from event_rsvps where user_id=$1 and event_id=$2`, [uid, eid]))[0]?.status;

    await as(U.owner, `insert into groups (slug, name, created_by) values ('strahd','Strahd Table',$1)`, [U.owner]);
    const gid = (await q(`select id from groups where slug='strahd'`))[0].id;
    await as(U.bob, `select public.join_group($1)`, [gid]);
    await as(U.owner, `select public.decide_join_request(id, true) from group_join_requests`);
    await q(`delete from notifications`);

    check('non-members cannot post group game days', /row-level security/.test(err(await as(U.cat, `insert into events (slug,title,group_id,starts_at,ends_at,visibility,created_by) values ('x','X',$1,now()+interval '1 day',now()+interval '1 day 4 hours','group',$2)`, [gid, U.cat])) ?? ''));
    check('group game day (INSERT ... RETURNING)', one(await as(U.owner, `insert into events (slug,title,group_id,starts_at,ends_at,visibility,capacity,created_by) values ('s1','Session 1',$1,now()+interval '1 day',now()+interval '1 day 4 hours','group',2,$2) returning slug`, [gid, U.owner]))?.slug === 's1');
    const eid = (await q(`select id from events where slug='s1'`))[0].id;
    check('group members told about it', (await q(`select count(*)::int n from notifications where user_id=$1`, [U.bob]))[0].n === 1);
    await as(U.owner, `insert into event_roles (event_id, role_name, max_count, position) values ($1,'DM',1,0),($1,'Player',4,1)`, [eid]);
    const role = Object.fromEntries((await q(`select role_name, id from event_roles where event_id=$1`, [eid])).map((r) => [r.role_name, r.id]));

    check('outsiders and anon cannot see group game days', (await as(U.cat, `select 1 from events`)).length === 0 && (await as(null, `select 1 from events`)).length === 0);
    check('outsiders cannot RSVP', /not found/.test(err(await as(U.cat, `select public.rsvp($1,'yes',$2)`, [eid, role.Player])) ?? ''));
    check('role required when roles exist', /Pick a role/.test(err(await as(U.bob, `select public.rsvp($1,'yes')`, [eid])) ?? ''));
    check('DM seat taken', one(await as(U.owner, `select public.rsvp($1,'yes',$2) s`, [eid, role.DM]))?.s === 'yes');
    check('full role -> waitlist', one(await as(U.bob, `select public.rsvp($1,'yes',$2) s`, [eid, role.DM]))?.s === 'waitlist');
    check('switching to an open role -> yes', one(await as(U.bob, `select public.rsvp($1,'yes',$2) s`, [eid, role.Player]))?.s === 'yes');
    check('organizer told about the yes', (await q(`select count(*)::int n from notifications where user_id=$1 and kind='event_rsvp'`, [U.owner]))[0].n === 1);

    await as(U.owner, `update events set visibility='public' where id=$1`, [eid]);
    check('full capacity -> waitlist #1', one(await as(U.cat, `select public.rsvp($1,'yes',$2) s`, [eid, role.Player]))?.s === 'waitlist');
    await as(U.dan, `select public.rsvp($1,'yes',$2) s`, [eid, role.Player]);
    await as(U.cat, `select public.rsvp($1,'yes',$2) s`, [eid, role.Player]);
    check('re-RSVP keeps your waitlist place', (await q(`select waitlist_position p from event_rsvps where user_id=$1`, [U.cat]))[0].p === 1);
    await as(U.bob, `select public.rsvp($1,'no')`, [eid]);
    check('a dropped yes promotes the first in line', (await status(U.cat, eid)) === 'yes' && (await status(U.dan, eid)) === 'waitlist');
    check('promoted person notified', (await q(`select count(*)::int n from notifications where user_id=$1 and kind='event_waitlist_promoted'`, [U.cat]))[0].n === 1);
    await as(U.owner, `update events set capacity=3 where id=$1`, [eid]);
    check('more seats promote the next in line', (await status(U.dan, eid)) === 'yes');
    check('no direct RSVP writes', /row-level security/.test(err(await as(U.bob, `insert into event_rsvps (event_id,user_id,status) values ($1,$2,'yes')`, [eid, U.bob])) ?? ''));
    check('members cannot edit the game day', (await as(U.bob, `update events set title='x' where id=$1 returning 1`, [eid])).length === 0);

    await q(`delete from notifications`);
    const seq = one(await as(U.owner, `update events set starts_at=starts_at+interval '1 hour', ends_at=ends_at+interval '1 hour' where id=$1 returning ics_sequence s`, [eid]))?.s;
    check('time change bumps ics_sequence', seq === 1, seq);
    const told = (await q(`select p.username from notifications n join profiles p on p.id=n.user_id order by 1`)).map((r) => r.username).join();
    check('attendees (not the editor) told about the change', told === 'cat,dan', told);

    await as(U.bob, `insert into events (slug,title,starts_at,ends_at,visibility,created_by) values ('secret','Secret',now()+interval '2 days',now()+interval '2 days 3 hours','hidden',$1)`, [U.bob]);
    const hid = (await q(`select id from events where slug='secret'`))[0].id;
    check('hidden game day invisible to others', (await as(U.dan, `select 1 from events where id=$1`, [hid])).length === 0);
    check('only organizers invite', /Only the organizer/.test(err(await as(U.dan, `select public.invite_to_event($1,'dan')`, [hid])) ?? ''));
    await as(U.bob, `select public.invite_to_event($1,'@Dan')`, [hid]);
    check('invitee can see and RSVP', (await as(U.dan, `select 1 from events where id=$1`, [hid])).length === 1 && one(await as(U.dan, `select public.rsvp($1,'yes') s`, [hid]))?.s === 'yes');
    await as(U.bob, `select public.uninvite_from_event($1,$2)`, [hid, U.dan]);
    check('uninvite on hidden drops the RSVP', (await q(`select count(*)::int n from event_rsvps where event_id=$1`, [hid]))[0].n === 0);
    await as(U.bob, `select public.cancel_event($1)`, [hid]);
    check('cancelled game day rejects RSVPs', /cancelled/.test(err(await as(U.bob, `select public.rsvp($1,'yes')`, [hid])) ?? ''));

    const tok = one(await as(U.cat, `select public.rotate_calendar_feed() t`))?.t;
    check('feed token is 64 hex chars', /^[a-f0-9]{64}$/.test(tok ?? ''));
    const feed = await as(null, `select title, my_status from public.calendar_feed_events($1)`, [tok]);
    check('feed works without a session and lists your game days', Array.isArray(feed) && feed.length === 1 && feed[0].my_status === 'yes', feed);
    check('unknown token returns nothing', (await as(null, `select 1 from public.calendar_feed_events('nope')`)).length === 0);
    check("others cannot read your token", (await as(U.dan, `select token from user_calendar_feeds`)).length === 0);
    check('waitlist helper not callable', /permission denied/.test(err(await as(U.dan, `select public._promote_waitlist($1)`, [eid])) ?? ''));
}
