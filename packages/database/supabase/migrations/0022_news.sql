-- ============================================================================
-- 0022_news.sql — Phase 5: news posts and anonymous voting
--
-- Anyone can read published posts. Admins write them (the Phase 6 agent
-- drafts will land here too). Anyone, signed in or not, can vote: the web
-- server hashes a browser fingerprint and the IP with FINGERPRINT_HMAC_SECRET
-- and calls cast_news_vote() with the service role. The vote tables have RLS
-- on and no policies, so nobody reads or writes them directly.
--
-- Hot score is Reddit's: sign(s) * log10(max(|s|, 1)) + published_epoch / 45000.
-- Newer posts start higher, so it never needs recomputing as time passes
-- (unlike the HN-style formula sketched in CLAUDE.md, which decays only when
-- someone votes). Every 10 net votes are worth 12.5 hours of age.
-- ============================================================================

create table public.news_categories (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null check (slug ~ '^[a-z0-9_-]+$'),
    name text not null,
    display_order int default 0 not null
);

insert into public.news_categories (slug, name, display_order) values
    ('official_news', 'Official News', 1),
    ('tactics', 'Tactics', 2),
    ('painting', 'Painting', 3),
    ('lore', 'Lore', 4),
    ('community', 'Community', 5),
    ('industry', 'Industry', 6);

create table public.news_posts (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
    title text not null check (char_length(title) between 2 and 160),
    body_md text not null,
    excerpt text check (excerpt is null or char_length(excerpt) <= 400),
    category_id uuid references public.news_categories(id) on delete set null,
    tags text[] default '{}' not null,
    source_url text check (source_url is null or source_url ~ '^https?://'),
    author_id uuid references public.profiles(id) on delete set null,
    status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
    published_at timestamptz,
    upvotes int default 0 not null,
    downvotes int default 0 not null,
    score int generated always as (upvotes - downvotes) stored,
    hot_score double precision default 0 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);
create index news_posts_status_published_idx on public.news_posts (status, published_at desc);
create index news_posts_hot_idx on public.news_posts (hot_score desc) where status = 'published';
create index news_posts_top_idx on public.news_posts (score desc) where status = 'published';
create index news_posts_tags_idx on public.news_posts using gin (tags);

create table public.news_votes (
    post_id uuid not null references public.news_posts(id) on delete cascade,
    fingerprint_hash text not null,
    vote smallint not null check (vote in (-1, 1)),
    ip_hash text,
    created_at timestamptz default now() not null,
    primary key (post_id, fingerprint_hash)
);
create index news_votes_fingerprint_idx on public.news_votes (fingerprint_hash);

-- One row per vote request, for the per-IP rate limit (30 per 10 minutes).
create table public.news_vote_log (
    ip_hash text not null,
    created_at timestamptz default now() not null
);
create index news_vote_log_ip_idx on public.news_vote_log (ip_hash, created_at desc);

-- ----------------------------------------------------------------------------
-- Scores
-- ----------------------------------------------------------------------------
create or replace function public.calculate_hot_score(ups int, downs int, published timestamptz)
returns double precision language sql immutable as $$
    select sign(ups - downs) * log(greatest(abs(ups - downs), 1)::numeric)::double precision
         + (extract(epoch from published) - 1134028003) / 45000.0;
$$;

-- Publishing stamps published_at; every write keeps hot_score current.
-- Vote counts only change from inside the news_votes trigger (depth 2), so an
-- admin's direct update can't set them.
create or replace function public.news_posts_before_write()
returns trigger language plpgsql as $$
begin
    if tg_op = 'INSERT' then
        new.upvotes := 0;
        new.downvotes := 0;
    elsif pg_trigger_depth() < 2 then
        new.upvotes := old.upvotes;
        new.downvotes := old.downvotes;
    end if;
    if new.status = 'published' and new.published_at is null then
        new.published_at := now();
    end if;
    new.hot_score := public.calculate_hot_score(
        new.upvotes, new.downvotes, coalesce(new.published_at, new.created_at, now()));
    if tg_op = 'UPDATE' then
        new.updated_at := now();
    end if;
    return new;
end;
$$;
create trigger news_posts_before_write
    before insert or update on public.news_posts
    for each row execute function public.news_posts_before_write();

create or replace function public.update_news_vote_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    pid uuid := coalesce(new.post_id, old.post_id);
begin
    update public.news_posts p set
        upvotes = (select count(*) from public.news_votes v where v.post_id = pid and v.vote = 1),
        downvotes = (select count(*) from public.news_votes v where v.post_id = pid and v.vote = -1)
    where p.id = pid;
    return null;
end;
$$;
create trigger news_votes_count
    after insert or update or delete on public.news_votes
    for each row execute function public.update_news_vote_counts();

-- ----------------------------------------------------------------------------
-- Voting (service role only; the web server hashes the fingerprint and IP)
--   p_vote: 1 up, -1 down, 0 clear. Returns the post's new counts.
-- ----------------------------------------------------------------------------
create or replace function public.cast_news_vote(p_post uuid, p_fingerprint text, p_ip text, p_vote int)
returns table (upvotes int, downvotes int, my_vote int)
language plpgsql security definer set search_path = public as $$
begin
    if p_vote not in (-1, 0, 1) then raise exception 'Vote must be 1, -1 or 0.'; end if;
    if coalesce(p_fingerprint, '') = '' then raise exception 'Missing visitor.'; end if;
    if not exists (select 1 from public.news_posts where id = p_post and status = 'published') then
        raise exception 'Post not found.';
    end if;

    if p_ip is not null then
        if (select count(*) from public.news_vote_log l
            where l.ip_hash = p_ip and l.created_at > now() - interval '10 minutes') >= 30 then
            raise exception 'Too many votes. Try again in a few minutes.';
        end if;
        insert into public.news_vote_log (ip_hash) values (p_ip);
        delete from public.news_vote_log where created_at < now() - interval '1 day';
    end if;

    if p_vote = 0 then
        delete from public.news_votes v where v.post_id = p_post and v.fingerprint_hash = p_fingerprint;
    else
        insert into public.news_votes as v (post_id, fingerprint_hash, vote, ip_hash)
        values (p_post, p_fingerprint, p_vote, p_ip)
        on conflict (post_id, fingerprint_hash)
        do update set vote = excluded.vote, ip_hash = excluded.ip_hash
        where v.vote <> excluded.vote;
    end if;

    return query
        select p.upvotes, p.downvotes, p_vote from public.news_posts p where p.id = p_post;
end;
$$;
revoke execute on function public.cast_news_vote(uuid, text, text, int) from public, anon, authenticated;

-- A visitor's own votes on a set of posts, to light up their arrows.
create or replace function public.my_news_votes(p_fingerprint text, p_posts uuid[])
returns table (post_id uuid, vote int)
language sql stable security definer set search_path = public as $$
    select v.post_id, v.vote::int from public.news_votes v
    where v.fingerprint_hash = p_fingerprint and v.post_id = any (p_posts);
$$;
revoke execute on function public.my_news_votes(text, uuid[]) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.news_categories enable row level security;
alter table public.news_posts enable row level security;
alter table public.news_votes enable row level security;
alter table public.news_vote_log enable row level security;

create policy news_categories_read on public.news_categories for select using (true);
create policy news_categories_admin on public.news_categories for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy news_posts_read on public.news_posts for select
    using (status = 'published' or public.is_admin(auth.uid()));
create policy news_posts_admin_insert on public.news_posts for insert
    with check (public.is_admin(auth.uid()));
create policy news_posts_admin_update on public.news_posts for update
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy news_posts_admin_delete on public.news_posts for delete
    using (public.is_admin(auth.uid()));
