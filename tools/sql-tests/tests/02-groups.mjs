export default async function ({ as, q, check, U }) {
    const err = (r) => (r && !Array.isArray(r) ? r.error : null);
    const one = (r) => (Array.isArray(r) ? r[0] : undefined);

    check('create group (INSERT ... RETURNING passes RLS)', one(await as(U.owner, `insert into groups (slug, name, created_by) values ('tuesday','Tuesday 40K',$1) returning slug`, [U.owner]))?.slug === 'tuesday');
    const gid = (await q(`select id from groups where slug='tuesday'`))[0].id;
    check('creator becomes owner', (await q(`select role from group_members where group_id=$1`, [gid]))[0]?.role === 'owner');
    check('anon can read a public group', (await as(null, `select name from groups`)).length === 1);

    check('request to join', one(await as(U.bob, `select public.join_group($1, 'hi') r`, [gid]))?.r === 'requested');
    await as(U.bob, `select public.join_group($1, 'hi') r`, [gid]);
    check('asking twice notifies admins once', (await q(`select count(*)::int n from notifications where user_id=$1`, [U.owner]))[0].n === 1);
    check('others cannot see the request', (await as(U.cat, `select count(*)::int n from group_join_requests`))[0].n === 0);

    const rid = (await q(`select id from group_join_requests`))[0].id;
    await as(U.owner, `select public.decide_join_request($1, true)`, [rid]);
    check('approved requester is a member and notified',
        (await q(`select role from group_members where group_id=$1 and user_id=$2`, [gid, U.bob]))[0]?.role === 'member' &&
        (await q(`select count(*)::int n from notifications where user_id=$1`, [U.bob]))[0].n === 1);

    check('no direct inserts into group_members', /row-level security/.test(err(await as(U.cat, `insert into group_members (group_id, user_id, role) values ($1,$2,'owner')`, [gid, U.cat])) ?? ''));
    check('members cannot invite', /Only group admins/.test(err(await as(U.bob, `select public.invite_member($1,'cat')`, [gid])) ?? ''));
    await as(U.owner, `select public.set_member_role($1,$2,'admin')`, [gid, U.bob]);
    check('admin invites by username (case/at-sign insensitive)', !err(await as(U.bob, `select public.invite_member($1,'@Cat')`, [gid])));
    check('invitee accepts via join_group', one(await as(U.cat, `select public.join_group($1) r`, [gid]))?.r === 'joined');
    check('admins cannot change roles', /Only the group owner/.test(err(await as(U.bob, `select public.set_member_role($1,$2,'admin')`, [gid, U.cat])) ?? ''));
    check('admin removes a member', !err(await as(U.bob, `select public.remove_member($1,$2)`, [gid, U.cat])));
    check('owner cannot leave', /Owners can't leave/.test(err(await as(U.owner, `select public.leave_group($1)`, [gid])) ?? ''));

    await as(U.bob, `update groups set join_policy='invite', visibility='private' where id=$1`, [gid]);
    check('outsiders cannot see a private group', (await as(U.dan, `select name from groups`)).length === 0);
    check('invite-only rejects joins', /invite only/.test(err(await as(U.dan, `select public.join_group($1) r`, [gid])) ?? ''));

    const tok = one(await as(U.bob, `select public.create_invite_link($1, 7, 1) t`, [gid]))?.t;
    check('invite link token is 32 hex chars', /^[a-f0-9]{32}$/.test(tok ?? ''));
    check('non-admins cannot read tokens', (await as(U.dan, `select token from group_invites where kind='link'`)).length === 0);
    check('anon can preview a link', one(await as(null, `select * from public.invite_link_preview($1)`, [tok]))?.is_valid === true);
    check('anon cannot redeem', /Sign in/.test(err(await as(null, `select public.redeem_invite_link($1)`, [tok])) ?? ''));
    check('redeem joins the group', one(await as(U.dan, `select public.redeem_invite_link($1) s`, [tok]))?.s === 'tuesday');
    check('max uses enforced', /used up/.test(err(await as(U.cat, `select public.redeem_invite_link($1) s`, [tok])) ?? ''));

    await as(U.owner, `select public.set_member_role($1,$2,'owner')`, [gid, U.bob]);
    const roles = Object.fromEntries((await q(`select p.username, m.role from group_members m join profiles p on p.id=m.user_id where group_id=$1`, [gid])).map((r) => [r.username, r.role]));
    check('ownership hand-over demotes old owner to admin', roles.bob === 'owner' && roles.owner === 'admin', roles);
    check('internal helpers are not callable', /permission denied/.test(err(await as(U.dan, `select public._add_group_member($1,$2)`, [gid, U.cat])) ?? ''));
    check('notify_user is not callable', /permission denied/.test(err(await as(U.dan, `select public.notify_user($1,'x','spam',null,null)`, [U.cat])) ?? ''));
}
