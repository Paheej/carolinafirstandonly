-- ============================================================================
-- 0001_init.sql — Phase 0 foundation
-- profiles, notifications, audit_log, profile auto-create trigger, base RLS
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- profiles
-- ============================================================================
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique not null,
    display_name text,
    avatar_url text,
    bio text,
    preferred_systems text[] default '{}',
    is_admin boolean default false not null,
    banned_until timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create index profiles_username_idx on public.profiles (lower(username));

-- ============================================================================
-- notifications
-- ============================================================================
create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    kind text not null,
    title text not null,
    body text,
    link_url text,
    read_at timestamptz,
    created_at timestamptz default now() not null
);

create index notifications_user_created_idx
    on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
    on public.notifications (user_id)
    where read_at is null;

-- ============================================================================
-- audit_log
-- ============================================================================
create table public.audit_log (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.profiles(id) on delete set null,
    action text not null,
    target_table text,
    target_id uuid,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);

create index audit_log_actor_created_idx
    on public.audit_log (actor_id, created_at desc);

create index audit_log_target_idx
    on public.audit_log (target_table, target_id);

-- ============================================================================
-- Helper: is_admin(uid) — used by RLS policies elsewhere
-- ============================================================================
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- ============================================================================
-- Trigger: ensure_profile_on_auth
--   After a new auth.users row is created, create a matching profiles row.
--   If the user's email is in the NEXT_PUBLIC_ADMIN_EMAILS allowlist, mark
--   them as admin. Allowlist is materialised at runtime via the
--   `app.admin_emails` GUC, which the application sets via SET LOCAL inside
--   a transaction OR we fall back to reading auth.users metadata.
--
--   Simpler approach used here: read the allowlist from `app.admin_emails`
--   (a comma-separated list set as a Postgres parameter). For local dev the
--   migration sets a default; in production, set it via the Supabase
--   dashboard (Database -> Configuration -> custom parameters) or run:
--     alter database postgres set app.admin_emails to 'a@b.com,c@d.com';
-- ============================================================================

-- Persist the allowlist on the database so every new session picks it up.
-- For production, run a follow-up migration that overrides this with the
-- real list, or set it via the Supabase dashboard
-- (Database → Configuration → Custom parameters).
do $$
declare
    db_name text := current_database();
begin
    execute format(
        'alter database %I set app.admin_emails = %L',
        db_name,
        'strepj@gmail.com'
    );
exception when insufficient_privilege then
    -- Hosted environments may forbid alter database; the trigger will fall
    -- back to an empty allowlist and no user will be auto-promoted to admin.
    raise notice 'Could not set app.admin_emails on database; set it manually.';
end $$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    base_username text;
    final_username text;
    suffix int := 0;
    allowlist text;
    is_allowed boolean := false;
begin
    -- Build a username from email local-part or random fallback.
    base_username := lower(coalesce(
        nullif(split_part(new.email, '@', 1), ''),
        'user_' || substr(new.id::text, 1, 8)
    ));
    -- Strip anything not [a-z0-9_].
    base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
    if base_username = '' then
        base_username := 'user_' || substr(new.id::text, 1, 8);
    end if;

    final_username := base_username;
    while exists (select 1 from public.profiles where username = final_username) loop
        suffix := suffix + 1;
        final_username := base_username || suffix::text;
    end loop;

    -- Admin allowlist check (case-insensitive).
    begin
        allowlist := current_setting('app.admin_emails', true);
    exception when others then
        allowlist := '';
    end;
    if allowlist is not null and allowlist <> '' and new.email is not null then
        is_allowed := lower(new.email) = any (
            select lower(trim(x)) from regexp_split_to_table(allowlist, ',') x
        );
    end if;

    insert into public.profiles (id, username, display_name, avatar_url, is_admin)
    values (
        new.id,
        final_username,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', final_username),
        new.raw_user_meta_data->>'avatar_url',
        is_allowed
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- profiles ------------------------------------------------------------------
-- Anyone (including anonymous visitors) can read public profile fields.
create policy "profiles_read_all"
    on public.profiles for select
    using (true);

create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

create policy "profiles_admin_all"
    on public.profiles for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

-- notifications -------------------------------------------------------------
create policy "notifications_read_own"
    on public.notifications for select
    using (auth.uid() = user_id);

create policy "notifications_update_own"
    on public.notifications for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "notifications_admin_all"
    on public.notifications for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

-- audit_log -----------------------------------------------------------------
-- Only admins can read; writes happen via security-definer functions / service role.
create policy "audit_log_admin_read"
    on public.audit_log for select
    using (public.is_admin(auth.uid()));
