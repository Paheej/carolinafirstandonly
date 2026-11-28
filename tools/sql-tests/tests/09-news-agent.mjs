export default async function ({ as, q, check, U }) {
    const err = (r) => (r && !Array.isArray(r) ? r.error : null);
    await q(`update profiles set is_admin = true where id = $1`, [U.owner]);

    // Seeded sources
    const sources = await q(`select name, source_type, enabled, channel_id, default_category_id from agent_sources order by name`);
    check('13 sources seeded', sources.length === 13, sources.length);
    check('every source has a default category', sources.every((s) => s.default_category_id), sources);
    const off = sources.filter((s) => !s.enabled).map((s) => s.name).sort();
    check('blocked and unresolved sources start switched off',
        off.join('|') === 'DakkaDakka News|Tabletop Gaming - The Australia Channel|Warhammer Community', off);
    check('enabled YouTube sources have channel IDs', sources.filter((s) => s.source_type === 'youtube' && s.enabled).every((s) => s.channel_id));
    const enableNoId = await q(`update agent_sources set enabled = true where channel_id is null and source_type = 'youtube'`).then(() => '', (e) => e.message);
    check('a YouTube source cannot be enabled without a channel ID', /check constraint/.test(enableNoId), enableNoId);

    // RLS: admins only
    check('anon cannot read sources', (await as(null, `select 1 from agent_sources`)).length === 0);
    check('members cannot read sources', (await as(U.bob, `select 1 from agent_sources`)).length === 0);
    check('admins read sources', (await as(U.owner, `select 1 from agent_sources`)).length === 13);
    check('members cannot change sources', (await as(U.bob, `update agent_sources set enabled = false returning 1`)).length === 0);
    check('admins switch sources off', (await as(U.owner, `update agent_sources set enabled = false where name = 'Goonhammer' returning 1`)).length === 1);

    // Drafts (written by the service role)
    const src = (await q(`select id from agent_sources where name = 'Goonhammer'`))[0].id;
    const cat = (await q(`select id from news_categories where slug = 'tactics'`))[0].id;
    const mk = async (url) => (await q(
        `insert into agent_drafts (source_id, source_url, source_title, draft_title, draft_body_md, draft_excerpt, suggested_category_id, suggested_tags, newsworthiness)
         values ($1, $2, 'Src', 'Draft title', 'Body [link](https://x.test)', 'Short', $3, '{40k}', 4) returning id`, [src, url, cat]))[0].id;
    const d1 = await mk('https://www.goonhammer.com/a/');
    const dupe = await mk('https://www.goonhammer.com/a/').then(() => '', (e) => e.message);
    check('one draft per source URL', /duplicate key/.test(dupe), dupe);
    check('members cannot read drafts', (await as(U.bob, `select 1 from agent_drafts`)).length === 0);
    check('admins read drafts', (await as(U.owner, `select 1 from agent_drafts`)).length === 1);
    check('admins edit drafts', (await as(U.owner, `update agent_drafts set draft_title = 'Edited' where id = $1 returning 1`, [d1])).length === 1);
    const fakePub = await as(U.owner, `update agent_drafts set status = 'published' where id = $1 returning 1`, [d1]);
    check('admins cannot mark a draft published without the RPC', /row-level security/.test(err(fakePub) ?? ''), fakePub);
    check('nobody inserts drafts directly, not even admins', /row-level security/.test(err(await as(U.owner, `insert into agent_drafts (source_url, draft_title, draft_body_md) values ('https://x.test/b', 't', 'b')`)) ?? ''));

    // Publishing
    const pub = (sql, params) => as(U.bob, sql, params);
    const memberPub = await pub(`select publish_agent_draft($1, 'nope', 'T', 'B', null, null, '{}')`, [d1]);
    check('members cannot publish drafts', /Only admins/.test(err(memberPub) ?? ''), memberPub);
    const ok = await as(U.owner, `select publish_agent_draft($1, 'agent-post', 'Final title', 'Final body', 'Ex', $2, '{40k,tactics}') as slug`, [d1, cat]);
    check('admin publishes a draft', ok[0]?.slug === 'agent-post', ok);
    const post = (await q(`select * from news_posts where slug = 'agent-post'`))[0];
    check('the post is live, with no author and the source link',
        post?.status === 'published' && post.author_id === null && post.source_url === 'https://www.goonhammer.com/a/' && post.published_at !== null, post);
    check('the post carries the edits', post?.title === 'Final title' && post.body_md === 'Final body' && post.tags.join(',') === '40k,tactics');
    const after = (await q(`select status, published_post_id, reviewed_by from agent_drafts where id = $1`, [d1]))[0];
    check('the draft is marked published and linked', after.status === 'published' && after.published_post_id === post?.id && after.reviewed_by === U.owner, after);
    check('publishing is audited', (await q(`select 1 from audit_log where action = 'agent_draft_published' and target_id = $1`, [post?.id])).length === 1);
    const twice = await as(U.owner, `select publish_agent_draft($1, 'agent-post-2', 'T', 'B', null, null, '{}')`, [d1]);
    check('a draft publishes only once', /already published/.test(err(twice) ?? ''), twice);

    const d2 = await mk('https://www.goonhammer.com/b/');
    const clash = await as(U.owner, `select publish_agent_draft($1, 'agent-post', 'T', 'B', null, null, '{}')`, [d2]);
    check('slug clashes are explained', /already uses that slug/.test(err(clash) ?? ''), clash);
    check('the failed publish left the draft alone', (await q(`select status from agent_drafts where id = $1`, [d2]))[0].status === 'draft');
    check('admins discard drafts', (await as(U.owner, `update agent_drafts set status = 'discarded' where id = $1 returning 1`, [d2])).length === 1);

    // Runs, budget, notifications (service role only)
    await q(`insert into agent_runs (trigger, status, cost_usd) values ('cron', 'ok', 1.25), ('manual', 'ok', 0.5)`);
    await q(`insert into agent_runs (trigger, status, cost_usd, started_at) values ('cron', 'ok', 99, now() - interval '40 days')`);
    const cost = Number((await q(`select agent_month_cost() c`))[0].c);
    check('month cost counts only this month', Math.abs(cost - 1.75) < 1e-9, cost);
    check('members cannot read runs', (await as(U.bob, `select 1 from agent_runs`)).length === 0);
    check('admins read runs', (await as(U.owner, `select 1 from agent_runs`)).length === 3);
    check('members cannot call agent_month_cost', /permission denied/.test(err(await as(U.bob, `select agent_month_cost()`)) ?? ''));
    check('members cannot call notify_admins', /permission denied/.test(err(await as(U.bob, `select notify_admins('x', 'y', null, null)`)) ?? ''));
    const n = (await q(`select notify_admins('agent_drafts', '2 new drafts', null, '/news/admin/drafts') n`))[0].n;
    check('notify_admins reaches each admin', n === 1 && (await q(`select 1 from notifications where user_id = $1 and kind = 'agent_drafts'`, [U.owner])).length === 1, n);
    check('nobody reads agent_seen_urls directly', (await as(U.owner, `select 1 from agent_seen_urls`)).length === 0);
}
