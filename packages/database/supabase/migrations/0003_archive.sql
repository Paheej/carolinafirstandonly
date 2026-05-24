-- ============================================================================
-- 0003_archive.sql — Phase 1
-- seasons, archive_events, recaps, recap_submissions
-- Plus: publish-on-approval, admin-notify-on-submit, submitter-notify-on-review
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

-- Convert arbitrary text to a slug. Trims, lowercases, replaces non-alnum with
-- '-', squashes runs, strips edges. Returns 'untitled' if input is empty.
create or replace function public.slugify(input text)
returns text
language plpgsql
immutable
as $$
declare
    s text;
begin
    if input is null then return 'untitled'; end if;
    s := lower(trim(input));
    s := regexp_replace(s, '[''"`]', '', 'g');
    s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
    s := regexp_replace(s, '^-+|-+$', '', 'g');
    if s = '' then return 'untitled'; end if;
    return s;
end;
$$;

-- Find an unused recap slug given a base. Appends -2, -3, ... until free.
create or replace function public.unique_recap_slug(base text)
returns text
language plpgsql
as $$
declare
    candidate text := base;
    n int := 1;
begin
    while exists (select 1 from public.recaps where slug = candidate) loop
        n := n + 1;
        candidate := base || '-' || n::text;
    end loop;
    return candidate;
end;
$$;

-- ============================================================================
-- seasons
-- ============================================================================
create table public.seasons (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    name text not null,
    year int,
    description_md text,
    hero_image_url text,
    starts_on date,
    ends_on date,
    display_order int default 0 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create index seasons_order_idx on public.seasons (display_order, starts_on desc nulls last);

-- ============================================================================
-- archive_events (special events outside the normal season cadence)
-- ============================================================================
create table public.archive_events (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    name text not null,
    event_date date,
    description_md text,
    hero_image_url text,
    season_id uuid references public.seasons(id) on delete set null,
    display_order int default 0 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create index archive_events_order_idx on public.archive_events (display_order, event_date desc nulls last);
create index archive_events_season_idx on public.archive_events (season_id);

-- ============================================================================
-- recaps (published)
-- photos jsonb shape: [{ "url": "...", "thumbnail_url": "...", "caption": "...",
--                       "file_id": "...", "width": int, "height": int }]
-- ============================================================================
create table public.recaps (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    season_id uuid references public.seasons(id) on delete set null,
    archive_event_id uuid references public.archive_events(id) on delete set null,
    title text not null,
    body_md text not null,
    photos jsonb default '[]'::jsonb not null,
    author_id uuid references public.profiles(id) on delete set null,
    published_at timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    constraint recap_target_present
        check (season_id is not null or archive_event_id is not null)
);

create index recaps_season_idx on public.recaps (season_id, published_at desc nulls last);
create index recaps_event_idx on public.recaps (archive_event_id, published_at desc nulls last);
create index recaps_published_idx on public.recaps (published_at desc) where published_at is not null;

-- ============================================================================
-- recap_submissions (review queue)
-- ============================================================================
create table public.recap_submissions (
    id uuid primary key default gen_random_uuid(),
    season_id uuid references public.seasons(id) on delete set null,
    archive_event_id uuid references public.archive_events(id) on delete set null,
    title text not null,
    body_md text not null,
    photos jsonb default '[]'::jsonb not null,
    author_id uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending','approved','rejected')),
    reviewed_by uuid references public.profiles(id) on delete set null,
    review_notes text,
    published_recap_id uuid references public.recaps(id) on delete set null,
    submitted_at timestamptz default now() not null,
    reviewed_at timestamptz,
    constraint submission_target_present
        check (season_id is not null or archive_event_id is not null)
);

create index recap_submissions_status_idx
    on public.recap_submissions (status, submitted_at desc);
create index recap_submissions_author_idx
    on public.recap_submissions (author_id, submitted_at desc);

-- ============================================================================
-- updated_at touchers
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger seasons_touch_updated_at
    before update on public.seasons
    for each row execute function public.touch_updated_at();

create trigger archive_events_touch_updated_at
    before update on public.archive_events
    for each row execute function public.touch_updated_at();

create trigger recaps_touch_updated_at
    before update on public.recaps
    for each row execute function public.touch_updated_at();

-- ============================================================================
-- Trigger: publish_recap_on_approval
--   When recap_submissions.status transitions to 'approved', insert into
--   recaps with published_at = now(), and link back via published_recap_id.
--   Slug derives from title via slugify() + uniquifier.
-- ============================================================================
create or replace function public.publish_recap_on_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    new_recap_id uuid;
    new_slug text;
begin
    if new.status = 'approved'
       and (old.status is distinct from 'approved')
       and new.published_recap_id is null
    then
        new_slug := public.unique_recap_slug(public.slugify(new.title));

        insert into public.recaps (
            slug, season_id, archive_event_id, title, body_md, photos,
            author_id, published_at
        ) values (
            new_slug, new.season_id, new.archive_event_id, new.title,
            new.body_md, new.photos, new.author_id, now()
        )
        returning id into new_recap_id;

        new.published_recap_id := new_recap_id;
        new.reviewed_at := coalesce(new.reviewed_at, now());
    elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
        new.reviewed_at := coalesce(new.reviewed_at, now());
    end if;

    return new;
end;
$$;

create trigger recap_submission_publish_on_approval
    before update on public.recap_submissions
    for each row execute function public.publish_recap_on_approval();

-- ============================================================================
-- Trigger: notify admins on new recap submission
-- ============================================================================
create or replace function public.notify_admins_on_recap_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    admin_row record;
    target_label text;
begin
    select case
        when new.season_id is not null then (select name from public.seasons where id = new.season_id)
        when new.archive_event_id is not null then (select name from public.archive_events where id = new.archive_event_id)
        else 'an archive entry'
    end into target_label;

    for admin_row in
        select id from public.profiles where is_admin = true
    loop
        insert into public.notifications (user_id, kind, title, body, link_url)
        values (
            admin_row.id,
            'recap_submitted',
            'New recap submission',
            coalesce(target_label, 'an archive entry') || ': "' || new.title || '"',
            '/archive/pending'
        );
    end loop;

    return new;
end;
$$;

create trigger recap_submission_notify_admins
    after insert on public.recap_submissions
    for each row execute function public.notify_admins_on_recap_submission();

-- ============================================================================
-- Trigger: notify submitter on review (approved or rejected)
-- ============================================================================
create or replace function public.notify_submitter_on_recap_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    link text;
    body_text text;
begin
    if new.status = old.status then return new; end if;

    if new.status = 'approved' then
        if new.published_recap_id is not null then
            select '/archive/recaps/' || slug into link
              from public.recaps where id = new.published_recap_id;
        end if;
        body_text := 'Your recap "' || new.title || '" is now live.';
        insert into public.notifications (user_id, kind, title, body, link_url)
        values (new.author_id, 'recap_approved', 'Recap approved', body_text, link);
    elsif new.status = 'rejected' then
        body_text := 'Your recap "' || new.title || '" needs changes.';
        if new.review_notes is not null and new.review_notes <> '' then
            body_text := body_text || ' Note: ' || new.review_notes;
        end if;
        insert into public.notifications (user_id, kind, title, body, link_url)
        values (new.author_id, 'recap_rejected', 'Recap needs changes', body_text, '/archive/submit');
    end if;

    return new;
end;
$$;

create trigger recap_submission_notify_submitter
    after update on public.recap_submissions
    for each row execute function public.notify_submitter_on_recap_review();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.seasons enable row level security;
alter table public.archive_events enable row level security;
alter table public.recaps enable row level security;
alter table public.recap_submissions enable row level security;

-- seasons + archive_events --------------------------------------------------
-- Public read, admin full write. (RLS bypasses for service role.)
create policy "seasons_read_all"
    on public.seasons for select using (true);
create policy "seasons_admin_all"
    on public.seasons for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

create policy "archive_events_read_all"
    on public.archive_events for select using (true);
create policy "archive_events_admin_all"
    on public.archive_events for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

-- recaps --------------------------------------------------------------------
-- Anyone may read published recaps. Authors may read their own drafts.
-- Admins read everything and may write.
create policy "recaps_read_published"
    on public.recaps for select
    using (published_at is not null);
create policy "recaps_read_own_drafts"
    on public.recaps for select
    using (auth.uid() = author_id);
create policy "recaps_admin_all"
    on public.recaps for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

-- recap_submissions ---------------------------------------------------------
-- Submitter can read + insert their own; can update title/body/photos only
-- while pending (status policed by the with-check below).
-- Admins read and update everything.
create policy "recap_submissions_read_own"
    on public.recap_submissions for select
    using (auth.uid() = author_id);

create policy "recap_submissions_insert_own"
    on public.recap_submissions for insert
    with check (
        auth.uid() = author_id
        and status = 'pending'
    );

create policy "recap_submissions_update_own_pending"
    on public.recap_submissions for update
    using (auth.uid() = author_id and status = 'pending')
    with check (auth.uid() = author_id and status = 'pending');

create policy "recap_submissions_delete_own_pending"
    on public.recap_submissions for delete
    using (auth.uid() = author_id and status = 'pending');

create policy "recap_submissions_admin_all"
    on public.recap_submissions for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));
