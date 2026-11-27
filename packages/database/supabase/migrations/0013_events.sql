-- ============================================================================
-- 0013_events.sql — Phase 3: game days, RSVPs, waitlists, invites, feeds
--
-- Visibility:
--   public : anyone can see it; anyone signed in can RSVP
--   group  : members of events.group_id only
--   hidden : only invited people (plus the organizer and group admins)
-- RSVPs go through public.rsvp(), which serializes on the event row so two
-- people can't take the last seat. When someone gives up a 'yes' seat (or
-- capacity grows) the earliest waitlisted person whose role has room is
-- promoted and notified.
-- Calendar feeds: each user can mint a secret token; calendar_feed_events()
-- returns their events for /api/calendar/<token>.ics without a session.
-- ============================================================================

create table public.events (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
    title text not null check (char_length(title) between 2 and 120),
    description_md text,
    group_id uuid references public.groups(id) on delete set null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    location text,
    visibility text not null default 'public' check (visibility in ('public', 'group', 'hidden')),
    capacity int check (capacity is null or capacity > 0),
    created_by uuid references public.profiles(id) on delete set null,
    cancelled_at timestamptz,
    ics_sequence int default 0 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    constraint events_time_order check (ends_at > starts_at),
    constraint events_group_visibility check (visibility <> 'group' or group_id is not null)
);
create index events_starts_idx on public.events (starts_at);
create index events_group_idx on public.events (group_id, starts_at);

create table public.event_roles (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    role_name text not null check (char_length(role_name) between 1 and 40),
    max_count int check (max_count is null or max_count > 0),
    position int default 0 not null,
    unique (event_id, role_name)
);

create table public.event_rsvps (
    event_id uuid not null references public.events(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    status text not null check (status in ('yes', 'no', 'maybe', 'waitlist')),
    role_id uuid references public.event_roles(id) on delete set null,
    waitlist_position int,
    note text check (char_length(note) <= 200),
    rsvped_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    primary key (event_id, user_id)
);
create index event_rsvps_user_idx on public.event_rsvps (user_id);

create table public.event_invites (
    event_id uuid not null references public.events(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    invited_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null,
    primary key (event_id, user_id)
);
create index event_invites_user_idx on public.event_invites (user_id);

create table public.user_calendar_feeds (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    token text unique not null,
    created_at timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.can_manage_event(eid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.events e
        where e.id = eid
          and (e.created_by = uid
               or (e.group_id is not null and public.is_group_admin(e.group_id, uid))
               or public.is_admin(uid))
    );
$$;

create or replace function public.can_see_event(eid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.events e
        where e.id = eid
          and (e.visibility = 'public'
               or e.created_by = uid
               or (e.visibility = 'group' and public.is_group_member(e.group_id, uid))
               or exists (select 1 from public.event_invites i where i.event_id = e.id and i.user_id = uid)
               or (e.group_id is not null and public.is_group_admin(e.group_id, uid))
               or public.is_admin(uid))
    );
$$;

-- Is there a 'yes' seat for this role, not counting except_uid's own RSVP?
create or replace function public._seat_available(eid uuid, rid uuid, except_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select
        coalesce((select e.capacity is null
                      or (select count(*) from public.event_rsvps r
                          where r.event_id = eid and r.status = 'yes'
                            and r.user_id is distinct from except_uid) < e.capacity
                  from public.events e where e.id = eid), false)
        and (rid is null or coalesce((
            select ro.max_count is null
                or (select count(*) from public.event_rsvps r
                    where r.event_id = eid and r.status = 'yes' and r.role_id = rid
                      and r.user_id is distinct from except_uid) < ro.max_count
            from public.event_roles ro where ro.id = rid), true));
$$;

-- Promote waitlisted people, earliest first, while their role has room.
create or replace function public._promote_waitlist(eid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
    r record;
    ev public.events;
begin
    select * into ev from public.events where id = eid;
    if not found or ev.cancelled_at is not null then return; end if;
    for r in
        select * from public.event_rsvps
        where event_id = eid and status = 'waitlist'
        order by waitlist_position nulls last, rsvped_at
    loop
        if public._seat_available(eid, r.role_id, r.user_id) then
            update public.event_rsvps
                set status = 'yes', waitlist_position = null, updated_at = now()
                where event_id = eid and user_id = r.user_id;
            perform public.notify_user(r.user_id, 'event_waitlist_promoted',
                'A seat opened up: you''re going to ' || ev.title, null, '/events/' || ev.slug);
        end if;
    end loop;
end;
$$;

-- Notify everyone with a live RSVP (yes/maybe/waitlist) except the actor.
create or replace function public._notify_attendees(eid uuid, p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
    insert into public.notifications (user_id, kind, title, body, link_url)
    select r.user_id, p_kind, p_title, p_body, '/events/' || e.slug
    from public.event_rsvps r join public.events e on e.id = r.event_id
    where r.event_id = eid and r.status in ('yes', 'maybe', 'waitlist')
      and r.user_id is distinct from auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- RSVP
-- Returns the resulting status: 'yes', 'maybe', 'no' or 'waitlist'.
-- ----------------------------------------------------------------------------
create or replace function public.rsvp(
    p_event uuid, p_status text, p_role uuid default null, p_note text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    ev public.events;
    prev public.event_rsvps;
    had_prev boolean;
    final text;
    pos int;
    who text;
begin
    if uid is null then raise exception 'Sign in to RSVP.'; end if;
    select * into ev from public.events where id = p_event for update;
    if not found or not public.can_see_event(p_event, uid) then raise exception 'Game day not found.'; end if;
    if ev.cancelled_at is not null then raise exception 'This game day was cancelled.'; end if;
    if ev.ends_at < now() then raise exception 'This game day is over.'; end if;
    if p_status not in ('yes', 'no', 'maybe') then raise exception 'Pick going, maybe or can''t go.'; end if;
    if p_role is not null and not exists (select 1 from public.event_roles where id = p_role and event_id = p_event) then
        raise exception 'That role isn''t part of this game day.';
    end if;
    if p_status = 'yes' and p_role is null and exists (select 1 from public.event_roles where event_id = p_event) then
        raise exception 'Pick a role.';
    end if;

    select * into prev from public.event_rsvps where event_id = p_event and user_id = uid;
    had_prev := found;

    if p_status = 'yes' then
        if public._seat_available(p_event, p_role, uid) then
            final := 'yes';
        else
            final := 'waitlist';
            -- Keep your place in line if you were already waiting for the same role.
            if had_prev and prev.status = 'waitlist' and prev.role_id is not distinct from p_role then
                pos := prev.waitlist_position;
            else
                select coalesce(max(waitlist_position), 0) + 1 into pos
                from public.event_rsvps where event_id = p_event;
            end if;
        end if;
    else
        final := p_status;
    end if;

    insert into public.event_rsvps (event_id, user_id, status, role_id, waitlist_position, note)
    values (p_event, uid, final, p_role, pos, nullif(trim(p_note), ''))
    on conflict (event_id, user_id) do update
        set status = excluded.status, role_id = excluded.role_id,
            waitlist_position = excluded.waitlist_position, note = excluded.note,
            updated_at = now();

    if had_prev and prev.status = 'yes' and (final <> 'yes' or prev.role_id is distinct from p_role) then
        perform public._promote_waitlist(p_event);
    end if;

    if final = 'yes' and not (had_prev and prev.status = 'yes') and ev.created_by is distinct from uid then
        select coalesce(display_name, username) into who from public.profiles where id = uid;
        perform public.notify_user(ev.created_by, 'event_rsvp',
            who || ' is going to ' || ev.title, null, '/events/' || ev.slug);
    end if;

    return final;
end;
$$;

-- ----------------------------------------------------------------------------
-- Organizer actions
-- ----------------------------------------------------------------------------
create or replace function public.invite_to_event(p_event uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
    ev public.events;
    target uuid;
    who text;
begin
    if not public.can_manage_event(p_event, auth.uid()) then raise exception 'Only the organizer can invite people.'; end if;
    select * into ev from public.events where id = p_event;
    select id into target from public.profiles
        where lower(username) = lower(trim(leading '@' from trim(p_username)));
    if target is null then raise exception 'No member called %.', p_username; end if;
    insert into public.event_invites (event_id, user_id, invited_by)
    values (p_event, target, auth.uid())
    on conflict do nothing;
    if found then
        select coalesce(display_name, username) into who from public.profiles where id = auth.uid();
        perform public.notify_user(target, 'event_invite',
            who || ' invited you to ' || ev.title, null, '/events/' || ev.slug);
    end if;
end;
$$;

create or replace function public.uninvite_from_event(p_event uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not public.can_manage_event(p_event, auth.uid()) then raise exception 'Only the organizer can do that.'; end if;
    delete from public.event_invites where event_id = p_event and user_id = p_user;
    -- On a hidden game day, losing the invite means losing the seat.
    if (select visibility from public.events where id = p_event) = 'hidden' then
        delete from public.event_rsvps where event_id = p_event and user_id = p_user;
    end if;
end;
$$;

create or replace function public.cancel_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ev public.events;
begin
    if not public.can_manage_event(p_event, auth.uid()) then raise exception 'Only the organizer can cancel it.'; end if;
    update public.events set cancelled_at = now() where id = p_event and cancelled_at is null
        returning * into ev;
    if found then
        perform public._notify_attendees(p_event, 'event_cancelled', ev.title || ' is cancelled', null);
    end if;
end;
$$;

create or replace function public.restore_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ev public.events;
begin
    if not public.can_manage_event(p_event, auth.uid()) then raise exception 'Only the organizer can do that.'; end if;
    update public.events set cancelled_at = null where id = p_event and cancelled_at is not null
        returning * into ev;
    if found then
        perform public._notify_attendees(p_event, 'event_restored', ev.title || ' is back on', null);
    end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Calendar feeds
-- ----------------------------------------------------------------------------
create or replace function public.rotate_calendar_feed()
returns text language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
    if auth.uid() is null then raise exception 'Sign in first.'; end if;
    insert into public.user_calendar_feeds (user_id, token) values (auth.uid(), t)
    on conflict (user_id) do update set token = excluded.token, created_at = now();
    return t;
end;
$$;

create or replace function public.delete_calendar_feed()
returns void language sql security definer set search_path = public as $$
    delete from public.user_calendar_feeds where user_id = auth.uid();
$$;

-- Events for a feed token: ones you're going to, might go to, are waiting
-- for, or organize. Includes recently cancelled ones so calendars drop them.
create or replace function public.calendar_feed_events(p_token text)
returns table (
    id uuid, slug text, title text, description_md text, location text,
    starts_at timestamptz, ends_at timestamptz, cancelled_at timestamptz,
    ics_sequence int, updated_at timestamptz, my_status text
) language sql stable security definer set search_path = public as $$
    select e.id, e.slug, e.title, e.description_md, e.location,
           e.starts_at, e.ends_at, e.cancelled_at, e.ics_sequence, e.updated_at,
           coalesce(r.status, case when e.created_by = f.user_id then 'yes' end)
    from public.user_calendar_feeds f
    join public.events e on true
    left join public.event_rsvps r on r.event_id = e.id and r.user_id = f.user_id
    where f.token = p_token
      and (r.status in ('yes', 'maybe', 'waitlist') or e.created_by = f.user_id)
      and e.ends_at > now() - interval '60 days'
    order by e.starts_at;
$$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
create trigger events_touch before update on public.events
    for each row execute function public.touch_updated_at();

-- Calendar clients only take an update when SEQUENCE goes up.
create or replace function public.events_bump_sequence()
returns trigger language plpgsql as $$
begin
    if (new.starts_at, new.ends_at, new.location, new.title, new.cancelled_at)
       is distinct from (old.starts_at, old.ends_at, old.location, old.title, old.cancelled_at) then
        new.ics_sequence := old.ics_sequence + 1;
    end if;
    return new;
end;
$$;
create trigger events_sequence before update on public.events
    for each row execute function public.events_bump_sequence();

create or replace function public.events_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.cancelled_at is null
       and (new.starts_at, new.location) is distinct from (old.starts_at, old.location) then
        perform public._notify_attendees(new.id, 'event_changed',
            new.title || ' changed: check the new time and place', null);
    end if;
    if new.capacity is distinct from old.capacity then
        perform public._promote_waitlist(new.id);
    end if;
    return new;
end;
$$;
create trigger events_after_update after update on public.events
    for each row execute function public.events_after_update();

-- New group game day: tell the group (hidden ones go out as invites instead).
create or replace function public.events_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
    if new.group_id is not null and new.visibility <> 'hidden' then
        select * into g from public.groups where id = new.group_id;
        insert into public.notifications (user_id, kind, title, body, link_url)
        select m.user_id, 'event_created', 'New game day in ' || g.name || ': ' || new.title,
               null, '/events/' || new.slug
        from public.group_members m
        where m.group_id = new.group_id and m.user_id is distinct from new.created_by;
    end if;
    return new;
end;
$$;
create trigger events_after_insert after insert on public.events
    for each row execute function public.events_after_insert();

create or replace function public.event_roles_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    perform public._promote_waitlist(coalesce(new.event_id, old.event_id));
    return null;
end;
$$;
create trigger event_roles_after_change after update of max_count or delete on public.event_roles
    for each row execute function public.event_roles_after_update();

revoke execute on function public._seat_available(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._promote_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public._notify_attendees(uuid, text, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_roles enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_invites enable row level security;
alter table public.user_calendar_feeds enable row level security;

-- Row columns first: inside INSERT ... RETURNING the helper can't see the new row.
create policy events_read on public.events for select
    using (visibility = 'public' or created_by = auth.uid() or public.can_see_event(id, auth.uid()));
create policy events_insert on public.events for insert to authenticated
    with check (created_by = auth.uid() and (group_id is null or public.is_group_member(group_id, auth.uid())));
create policy events_update on public.events for update
    using (public.can_manage_event(id, auth.uid()))
    with check (group_id is null or public.is_group_member(group_id, auth.uid()) or public.is_admin(auth.uid()));
create policy events_delete on public.events for delete
    using (public.can_manage_event(id, auth.uid()));

create policy event_roles_read on public.event_roles for select
    using (public.can_see_event(event_id, auth.uid()));
create policy event_roles_write on public.event_roles for all
    using (public.can_manage_event(event_id, auth.uid()))
    with check (public.can_manage_event(event_id, auth.uid()));

-- RSVPs are written only through rsvp().
create policy event_rsvps_read on public.event_rsvps for select
    using (public.can_see_event(event_id, auth.uid()));

create policy event_invites_read on public.event_invites for select
    using (user_id = auth.uid() or public.can_manage_event(event_id, auth.uid()));

create policy user_calendar_feeds_read on public.user_calendar_feeds for select
    using (user_id = auth.uid());
