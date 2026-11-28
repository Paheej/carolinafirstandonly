export default async function ({ as, q, check, U }) {
    const err = (r) => (r && !Array.isArray(r) ? r.error : null);
    await q(`update profiles set is_admin = true where id = $1`, [U.owner]);

    const cats = (await q(`select slug from news_categories order by display_order`)).map((r) => r.slug);
    check('six categories, no battle_report', cats.join(',') === 'official_news,tactics,painting,lore,community,industry', cats);
    check('anyone can read categories', (await as(null, `select 1 from news_categories`)).length === 6);

    const cat = (await q(`select id from news_categories where slug='tactics'`))[0].id;
    const ins = (uid, slug, status = 'draft') =>
        as(uid, `insert into news_posts (slug, title, body_md, category_id, status, author_id, upvotes) values ($1, $2, 'Body', $3, $4, $5, 99) returning id, published_at, upvotes`,
            [slug, `Post ${slug}`, cat, status, uid]);

    check('members cannot write posts', /row-level security/.test(err(await ins(U.bob, 'nope')) ?? ''));
    const draft = (await ins(U.owner, 'draft-one'))[0];
    check('admin writes a draft; vote counts start at 0', draft?.id && draft.published_at === null && draft.upvotes === 0, draft);
    check('drafts are hidden from the public', (await as(null, `select 1 from news_posts where slug='draft-one'`)).length === 0);
    check('drafts are hidden from members', (await as(U.bob, `select 1 from news_posts where slug='draft-one'`)).length === 0);
    check('admins see drafts', (await as(U.owner, `select 1 from news_posts where slug='draft-one'`)).length === 1);

    await as(U.owner, `update news_posts set status='published' where id=$1`, [draft.id]);
    const pub = (await q(`select published_at, hot_score from news_posts where id=$1`, [draft.id]))[0];
    check('publishing stamps published_at', pub.published_at !== null, pub);
    check('the public can read it now', (await as(null, `select 1 from news_posts where slug='draft-one'`)).length === 1);
    check('members cannot edit it', (await as(U.bob, `update news_posts set title='x' where id=$1 returning 1`, [draft.id])).length === 0);
    await as(U.owner, `update news_posts set upvotes=500 where id=$1`, [draft.id]);
    check('admins cannot set vote counts directly', (await q(`select upvotes from news_posts where id=$1`, [draft.id]))[0].upvotes === 0);

    // Voting: service role only.
    check('anon cannot call cast_news_vote', /permission denied/.test(err(await as(null, `select * from cast_news_vote($1,'fp','ip',1)`, [draft.id])) ?? ''));
    check('members cannot call cast_news_vote', /permission denied/.test(err(await as(U.bob, `select * from cast_news_vote($1,'fp','ip',1)`, [draft.id])) ?? ''));
    check('nobody reads votes directly', (await as(U.owner, `select 1 from news_votes`)).length === 0);

    const vote = async (fp, v, ip = 'ip-a') => (await q(`select * from cast_news_vote($1,$2,$3,$4)`, [draft.id, fp, ip, v]))[0];
    let r = await vote('fp1', 1);
    check('upvote counts', r.upvotes === 1 && r.downvotes === 0 && r.my_vote === 1, r);
    r = await vote('fp1', 1);
    check('same vote twice counts once', r.upvotes === 1, r);
    await vote('fp2', 1);
    r = await vote('fp3', -1);
    check('three visitors: 2 up, 1 down', r.upvotes === 2 && r.downvotes === 1, r);
    r = await vote('fp1', -1);
    check('switching a vote moves it', r.upvotes === 1 && r.downvotes === 2, r);
    r = await vote('fp1', 0);
    check('clearing a vote removes it', r.upvotes === 1 && r.downvotes === 1, r);
    const mine = await q(`select * from my_news_votes('fp3', array[$1]::uuid[])`, [draft.id]);
    check('my_news_votes returns your vote', mine.length === 1 && mine[0].vote === -1, mine);
    check('score column follows the counts', (await q(`select score from news_posts where id=$1`, [draft.id]))[0].score === 0);

    const draft2 = (await ins(U.owner, 'draft-two'))[0];
    const draftVote = await q(`select * from cast_news_vote($1,'fp1','ip-a',1)`, [draft2.id]).then(() => '', (e) => e.message);
    check('cannot vote on a draft', /Post not found/.test(draftVote), draftVote);

    // Hot score: a net +10 post is worth 12.5 hours of age.
    const hs = await q(`select calculate_hot_score(11, 1, '2026-01-01T00:00:00Z') - calculate_hot_score(0, 0, '2026-01-01T12:30:00Z') d`);
    check('hot: +10 votes = 12.5 hours', Math.abs(hs[0].d) < 1e-9, hs[0]);
    await q(`select * from cast_news_vote($1,'fp9','ip-z',1)`, [draft.id]);
    const after = (await q(`select hot_score, calculate_hot_score(upvotes, downvotes, published_at) want from news_posts where id=$1`, [draft.id]))[0];
    check('votes keep hot_score current', Math.abs(after.hot_score - after.want) < 1e-9, after);

    // Rate limit: 30 per IP per 10 minutes.
    let limited = '';
    for (let i = 0; i < 31 && !limited; i++) {
        try { await q(`select * from cast_news_vote($1,$2,'ip-flood',1)`, [draft.id, `flood-${i}`]); } catch (e) { limited = `${i}:${e.message}`; }
    }
    check('31st vote from one IP is refused', /^30:Too many votes/.test(limited), limited);
    check('other IPs still vote', (await vote('fp-other', 1, 'ip-b')).my_vote === 1);
}
