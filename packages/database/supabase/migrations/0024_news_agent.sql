-- ============================================================================
-- 0024_news_agent.sql — Phase 6: the AI news agent
--
-- Once a day (Vercel Cron) the web app reads each enabled source, asks Claude
-- to draft a short newsletter item for each new link, and stores the useful
-- ones in agent_drafts. Admins review them at /news/admin/drafts. Publishing
-- one makes a news_posts row with author_id = null and source_url set (the
-- feed shows "via <host>").
--
-- agent_runs records every run: what it read, what it drafted, the tokens it
-- used and what that cost. The pipeline stops calling Claude once this
-- month's cost reaches the budget (AGENT_MONTHLY_BUDGET_USD, default $20) and
-- tells the admins.
--
-- Everything here is admin-only. The pipeline itself writes with the service
-- role.
-- ============================================================================

create table public.agent_sources (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    source_type text not null check (source_type in ('rss', 'youtube', 'web_scrape')),
    url text not null check (url ~ '^https?://'),
    channel_id text check (channel_id is null or channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
    enabled boolean default true not null,
    default_category_id uuid references public.news_categories(id) on delete set null,
    default_tags text[] default '{}' not null,
    -- Per-source tuning: link_pattern / exclude_pattern (regexes on item URLs),
    -- max_items (new items per run, default 5).
    config jsonb default '{}'::jsonb not null,
    notes text,
    last_run_at timestamptz,
    last_error text,
    last_item_count int,
    created_at timestamptz default now() not null,
    check (source_type <> 'youtube' or channel_id is not null or not enabled)
);

create table public.agent_drafts (
    id uuid primary key default gen_random_uuid(),
    source_id uuid references public.agent_sources(id) on delete cascade,
    source_url text not null unique check (source_url ~ '^https?://'),
    source_title text,
    source_published_at timestamptz,
    raw_excerpt text,
    draft_title text not null,
    draft_body_md text not null,
    draft_excerpt text,
    suggested_category_id uuid references public.news_categories(id) on delete set null,
    suggested_tags text[] default '{}' not null,
    newsworthiness smallint check (newsworthiness between 1 and 5),
    status text not null default 'draft' check (status in ('draft', 'published', 'discarded')),
    published_post_id uuid references public.news_posts(id) on delete set null,
    reviewed_by uuid references public.profiles(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);
create index agent_drafts_status_idx on public.agent_drafts (status, created_at desc);

-- Links the agent read and decided weren't worth a draft. Kept so the next run
-- doesn't pay to read them again.
create table public.agent_seen_urls (
    url text primary key,
    source_id uuid references public.agent_sources(id) on delete cascade,
    reason text,
    created_at timestamptz default now() not null
);

create table public.agent_runs (
    id uuid primary key default gen_random_uuid(),
    trigger text not null check (trigger in ('cron', 'manual')),
    triggered_by uuid references public.profiles(id) on delete set null,
    status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed', 'over_budget')),
    started_at timestamptz default now() not null,
    finished_at timestamptz,
    items_found int default 0 not null,
    drafts_created int default 0 not null,
    items_skipped int default 0 not null,
    input_tokens int default 0 not null,
    output_tokens int default 0 not null,
    cost_usd numeric(10, 4) default 0 not null,
    model text,
    errors jsonb default '[]'::jsonb not null
);
create index agent_runs_started_idx on public.agent_runs (started_at desc);

create or replace function public.agent_drafts_touch()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;
create trigger agent_drafts_touch before update on public.agent_drafts
    for each row execute function public.agent_drafts_touch();

-- ----------------------------------------------------------------------------
-- Publishing a draft (admins). One transaction: the post, the draft's status
-- and an audit row. Returns the new post's slug.
-- ----------------------------------------------------------------------------
create or replace function public.publish_agent_draft(
    p_draft uuid,
    p_slug text,
    p_title text,
    p_body_md text,
    p_excerpt text,
    p_category uuid,
    p_tags text[]
) returns text
language plpgsql security definer set search_path = public as $$
declare
    d public.agent_drafts;
    post_id uuid;
begin
    if not public.is_admin(auth.uid()) then
        raise exception 'Only admins can publish drafts.';
    end if;
    select * into d from public.agent_drafts where id = p_draft for update;
    if not found then raise exception 'That draft no longer exists.'; end if;
    if d.status <> 'draft' then raise exception 'That draft was already %.', d.status; end if;
    if exists (select 1 from public.news_posts where slug = p_slug) then
        raise exception 'Another post already uses that slug. Pick a different one.';
    end if;

    insert into public.news_posts (slug, title, body_md, excerpt, category_id, tags, source_url, author_id, status)
    values (p_slug, p_title, p_body_md, nullif(trim(p_excerpt), ''), p_category, coalesce(p_tags, '{}'), d.source_url, null, 'published')
    returning id into post_id;

    update public.agent_drafts set
        status = 'published', published_post_id = post_id,
        draft_title = p_title, draft_body_md = p_body_md, draft_excerpt = p_excerpt,
        suggested_category_id = p_category, suggested_tags = coalesce(p_tags, '{}'),
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_draft;

    insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'agent_draft_published', 'news_posts', post_id, jsonb_build_object('draft_id', p_draft, 'source_url', d.source_url));
    return p_slug;
end;
$$;
revoke execute on function public.publish_agent_draft(uuid, text, text, text, text, uuid, text[]) from public, anon;
grant execute on function public.publish_agent_draft(uuid, text, text, text, text, uuid, text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Pipeline helpers (service role only)
-- ----------------------------------------------------------------------------
-- What this calendar month's runs have cost so far (UTC months).
create or replace function public.agent_month_cost()
returns numeric language sql stable security definer set search_path = public as $$
    select coalesce(sum(cost_usd), 0) from public.agent_runs
    where started_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;
revoke execute on function public.agent_month_cost() from public, anon, authenticated;

-- One in-app notification for every admin.
create or replace function public.notify_admins(p_kind text, p_title text, p_body text, p_link text)
returns int language plpgsql security definer set search_path = public as $$
declare
    n int;
begin
    insert into public.notifications (user_id, kind, title, body, link_url)
    select id, p_kind, p_title, p_body, p_link from public.profiles where is_admin = true;
    get diagnostics n = row_count;
    return n;
end;
$$;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS: admins only. The service role bypasses RLS.
-- ----------------------------------------------------------------------------
alter table public.agent_sources enable row level security;
alter table public.agent_drafts enable row level security;
alter table public.agent_seen_urls enable row level security;
alter table public.agent_runs enable row level security;

create policy agent_sources_admin on public.agent_sources for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy agent_drafts_admin_read on public.agent_drafts for select
    using (public.is_admin(auth.uid()));
-- Admins edit and discard drafts directly; publishing goes through the RPC.
create policy agent_drafts_admin_update on public.agent_drafts for update
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()) and status in ('draft', 'discarded'));
create policy agent_runs_admin_read on public.agent_runs for select
    using (public.is_admin(auth.uid()));
-- agent_seen_urls: no policies (service role only).

-- ----------------------------------------------------------------------------
-- Sources (CLAUDE.md -> AI Agent). Checked 2026-11-28:
--   * Warhammer Community answers automated requests with 403, and DakkaDakka
--     sits behind a Cloudflare challenge. Both are seeded switched off.
--   * Bolter and Chainsword has no news page worth scraping, but its RSS feed
--     works (mostly forum, blog and gallery posts, so galleries are skipped).
--   * The Miniatures Page is http only; its index links each story as news/<id>/.
--   * YouTube IDs came from scripts/resolve-youtube-channels.mjs. Chapter
--     Valrak's channel is "Chapter Master Valrak". Pro Acryl's videos are on
--     its maker's channel, Monument Hobbies. "Tabletop Gaming - The Australia
--     Channel" couldn't be found, so it waits for a link.
-- ----------------------------------------------------------------------------
insert into public.agent_sources (name, source_type, url, channel_id, enabled, default_category_id, default_tags, config, notes)
select s.name, s.source_type, s.url, s.channel_id, s.enabled,
       (select id from public.news_categories c where c.slug = s.category),
       s.tags, s.config::jsonb, s.notes
from (values
    ('Goonhammer', 'rss', 'https://www.goonhammer.com/feed/', null, true, 'tactics', '{}'::text[], '{}', null),
    ('Warhammer Community', 'rss', 'https://www.warhammer-community.com/feed/', null, false, 'official_news', '{}'::text[], '{}',
        'Off: the site answers automated requests with 403 Forbidden.'),
    ('Bell of Lost Souls', 'rss', 'https://www.belloflostsouls.net/feed', null, true, 'industry', '{}'::text[], '{}', null),
    ('Spikey Bits', 'rss', 'https://spikeybits.com/feed', null, true, 'industry', '{}'::text[], '{}', null),
    ('The Miniatures Page', 'web_scrape', 'http://theminiaturespage.com/news/', null, true, 'industry', '{}'::text[],
        '{"link_pattern": "/news/[0-9]+/$", "max_items": 3}', null),
    ('DakkaDakka News', 'web_scrape', 'https://www.dakkadakka.com/dakkaforum/forums/show/1.page', null, false, 'community', '{}'::text[], '{}',
        'Off: the forum sits behind a Cloudflare bot check.'),
    ('Bolter and Chainsword', 'rss', 'https://www.bolterandchainsword.com/rss/1-bolter-and-chainsword-news.xml/', null, true, 'community', '{40k}'::text[],
        '{"exclude_pattern": "/gallery/", "max_items": 3}', 'The site''s RSS feed (forum, blogs and news). Gallery posts are skipped.'),
    ('Chapter Master Valrak', 'youtube', 'https://www.youtube.com/@ChapterMasterValrak', 'UCrCHY6wVw5D7hMsM-LPBr1w', true, 'official_news', '{40k}'::text[], '{}', null),
    ('Auspex Tactics', 'youtube', 'https://www.youtube.com/@AuspexTactics', 'UC6Gco9PWxmJmJ5CqfbChuiQ', true, 'tactics', '{40k}'::text[], '{}', null),
    ('Play On Tabletop', 'youtube', 'https://www.youtube.com/@PlayOnTabletop', 'UCJ4-WFTrDNWvcM7dEC6E2mw', true, 'tactics', '{}'::text[], '{}', null),
    ('Paul Is Bad at Stuff', 'youtube', 'https://www.youtube.com/@PaulIsBadAtStuff', 'UCTtI24dTdjFm8rbDx_P2ZTQ', true, 'community', '{}'::text[], '{}', null),
    ('Tabletop Gaming - The Australia Channel', 'youtube', 'https://www.youtube.com/', null, false, 'community', '{}'::text[], '{}',
        'Off until someone adds the channel: its handle couldn''t be found.'),
    ('Pro Acryl (Monument Hobbies)', 'youtube', 'https://www.youtube.com/@monumenthobbies', 'UCKkhdUiappmwm6Yd5Ea3GEg', true, 'painting', '{painting}'::text[], '{}', null)
) as s(name, source_type, url, channel_id, enabled, category, tags, config, notes);
