-- ============================================================================
-- 0014_calendar_sync.sql — Phase 4: busy-time sync and group availability
--
-- A member connects a calendar by pasting its private ICS link (iCloud public
-- calendar, Google "secret address in iCal format", Outlook "publish
-- calendar"). The web server encrypts the link with AES-256-GCM before it is
-- stored, so the database never holds it in plain text. google/outlook are
-- reserved for OAuth connections later; those store an encrypted refresh token
-- in the same column.
--
-- Sync (server, service role) turns each calendar into busy windows only:
-- start and end, never titles, places or attendees. replace_busy_blocks()
-- swaps a connection's blocks atomically.
--
-- group_availability() returns counts, never people: "5 of 8 free".
-- ============================================================================

create table public.calendar_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    provider text not null default 'ics' check (provider in ('ics', 'google', 'outlook')),
    label text not null check (char_length(label) between 1 and 60),
    source_host text,                    -- e.g. "p42-caldav.icloud.com", for display only
    encrypted_secret text not null,      -- AES-GCM: ICS link or OAuth refresh token
    enabled boolean default true not null,
    last_synced_at timestamptz,
    last_error text,
    block_count int default 0 not null,
    created_at timestamptz default now() not null
);
create index calendar_connections_user_idx on public.calendar_connections (user_id);

create table public.user_busy_blocks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    connection_id uuid not null references public.calendar_connections(id) on delete cascade,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    constraint user_busy_blocks_order check (ends_at > starts_at)
);
create index user_busy_blocks_user_idx on public.user_busy_blocks (user_id, starts_at, ends_at);
create index user_busy_blocks_conn_idx on public.user_busy_blocks (connection_id);

-- At most five calendars each.
create or replace function public._calendar_connection_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if (select count(*) from public.calendar_connections where user_id = new.user_id) >= 5 then
        raise exception 'You can connect up to 5 calendars.';
    end if;
    return new;
end;
$$;
create trigger calendar_connections_limit before insert on public.calendar_connections
    for each row execute function public._calendar_connection_limit();

-- Owners can rename or pause a connection, but not move it to someone else.
create or replace function public._calendar_connection_guard()
returns trigger language plpgsql as $$
begin
    if new.user_id <> old.user_id or new.provider <> old.provider then
        raise exception 'A calendar connection can''t change owner or provider.';
    end if;
    return new;
end;
$$;
create trigger calendar_connections_guard before update on public.calendar_connections
    for each row execute function public._calendar_connection_guard();

-- ----------------------------------------------------------------------------
-- Sync writes (service role only)
-- ----------------------------------------------------------------------------
-- p_blocks: [{"s": "<iso>", "e": "<iso>"}, ...]
create or replace function public.replace_busy_blocks(p_connection uuid, p_blocks jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
    uid uuid;
    n int;
begin
    select user_id into uid from public.calendar_connections where id = p_connection for update;
    if uid is null then raise exception 'Calendar connection not found.'; end if;
    delete from public.user_busy_blocks where connection_id = p_connection;
    insert into public.user_busy_blocks (user_id, connection_id, starts_at, ends_at)
    select uid, p_connection, (b->>'s')::timestamptz, (b->>'e')::timestamptz
    from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) b
    where (b->>'e')::timestamptz > (b->>'s')::timestamptz;
    get diagnostics n = row_count;
    update public.calendar_connections
        set last_synced_at = now(), last_error = null, block_count = n
        where id = p_connection;
    return n;
end;
$$;
revoke execute on function public.replace_busy_blocks(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public._calendar_connection_limit() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Availability (group members only; counts, never names)
-- ----------------------------------------------------------------------------
-- Checks the window [p_start, p_end) on p_days consecutive days, starting with
-- the given one. Days step in Eastern wall-clock time, so 1 PM stays 1 PM
-- across a DST change.
--   members   : people in the group
--   connected : members with at least one synced calendar
--   free      : connected members with no busy time in the window
create or replace function public.group_availability(
    p_group uuid, p_start timestamptz, p_end timestamptz, p_days int default 1)
returns table (day_index int, starts_at timestamptz, ends_at timestamptz, members int, connected int, free int)
language plpgsql stable security definer set search_path = public as $$
begin
    if auth.uid() is null or not (public.is_group_member(p_group, auth.uid()) or public.is_admin(auth.uid())) then
        raise exception 'Only group members can see availability.';
    end if;
    if p_end <= p_start or p_end - p_start > interval '24 hours' then
        raise exception 'Pick a window of 24 hours or less.';
    end if;
    if p_days < 1 or p_days > 21 then
        raise exception 'Check between 1 and 21 days.';
    end if;
    return query
    with days as (
        select d::int as i,
               ((p_start at time zone 'America/New_York') + d * interval '1 day') at time zone 'America/New_York' as s,
               ((p_end at time zone 'America/New_York') + d * interval '1 day') at time zone 'America/New_York' as e
        from generate_series(0, p_days - 1) d
    ),
    m as (select gm.user_id from public.group_members gm where gm.group_id = p_group),
    c as (
        select distinct m.user_id from m
        join public.calendar_connections cc on cc.user_id = m.user_id
        where cc.enabled and cc.last_synced_at is not null
    )
    select days.i, days.s, days.e,
           (select count(*)::int from m),
           (select count(*)::int from c),
           (select count(*)::int from c
            where not exists (
                select 1 from public.user_busy_blocks b
                join public.calendar_connections cc on cc.id = b.connection_id and cc.enabled
                where b.user_id = c.user_id and b.starts_at < days.e and b.ends_at > days.s))
    from days order by days.i;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.calendar_connections enable row level security;
alter table public.user_busy_blocks enable row level security;

create policy calendar_connections_own_read on public.calendar_connections for select
    using (user_id = auth.uid());
create policy calendar_connections_own_insert on public.calendar_connections for insert to authenticated
    with check (user_id = auth.uid());
create policy calendar_connections_own_update on public.calendar_connections for update
    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy calendar_connections_own_delete on public.calendar_connections for delete
    using (user_id = auth.uid());

-- Your own busy blocks only. Nobody else sees them, not even group admins.
create policy user_busy_blocks_own_read on public.user_busy_blocks for select
    using (user_id = auth.uid());
