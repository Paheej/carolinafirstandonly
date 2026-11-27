export default async function ({ as, q, check, U }) {
    const names = (await q(`select username from profiles order by username`)).map((r) => r.username);
    check('signup trigger creates a profile per user', names.join() === 'bob,cat,dan,owner', names);
    const r = await as(U.bob, `update profiles set is_admin = true, bio = 'hi' where id = $1 returning is_admin, bio`, [U.bob]);
    check('users cannot make themselves admin (0012)', r[0]?.is_admin === false && r[0]?.bio === 'hi', r);
}
