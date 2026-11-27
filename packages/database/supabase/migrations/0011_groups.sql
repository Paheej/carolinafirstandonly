-- ============================================================================
-- 0011_groups.sql — Phase 2: groups, membership, join requests, invites
--
-- Membership changes go through security-definer functions (join_group,
-- decide_join_request, invite_member, ...) instead of direct table writes,
-- so the rules live in one place:
--   - join_policy 'open'    : anyone signed in joins straight away
--   - join_policy 'request' : members ask, a group admin approves or declines
--   - join_policy 'invite'  : only invited people (by username or link) get in
--   - roles: owner (one per group, the creator), admin, member
--   - owners manage admins; admins manage members, requests and invites
-- Every step notifies the people involved through public.notifications.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.groups (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
    name text not null check (char_length(name) between 2 and 80),
    description_md text,
    systems text[] default '{}' not null,
    visibility text not null default 'public' check (visibility in ('public', 'private')),
    join_policy text not null default 'request' check (join_policy in ('open', 'request', 'invite')),
    banner_url text,
    accent_color text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create table public.group_members (
    group_id uuid not null references public.groups(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    role text not null default 'member' check (role in ('owner', 'admin', 'member')),
    joined_at timestamptz default now() not null,
    primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);
create unique index group_members_one_owner on public.group_members (group_id) where role = 'owner';

create table public.group_join_requests (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.groups(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    message text check (char_length(message) <= 500),
    status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
    decided_by uuid references public.profiles(id) on delete set null,
    decided_at timestamptz,
    created_at timestamptz default now() not null
);
create unique index group_join_requests_one_pending
    on public.group_join_requests (group_id, user_id) where status = 'pending';

-- kind 'direct': a named person was invited. kind 'link': a shareable token.
create table public.group_invites (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.groups(id) on delete cascade,
    kind text not null check (kind in ('direct', 'link')),
    invited_user_id uuid references public.profiles(id) on delete cascade,
    token text unique,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
    uses int default 0 not null,
    max_uses int,
    expires_at timestamptz,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null,
    constraint group_invites_shape check (
        (kind = 'direct' and invited_user_id is not null and token is null)
        or (kind = 'link' and invited_user_id is null and token is not null)
    )
);
create unique index group_invites_one_pending_direct
    on public.group_invites (group_id, invited_user_id) where kind = 'direct' and status = 'pending';

create table public.group_pinned_posts (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.groups(id) on delete cascade,
    author_id uuid references public.profiles(id) on delete set null,
    title text not null,
    body_md text not null,
    position int default 0 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);
create index group_pinned_posts_group_idx on public.group_pinned_posts (group_id, position);

create table public.group_role_templates (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.groups(id) on delete cascade,
    role_name text not null,
    default_max int,
    position int default 0 not null
);
create index group_role_templates_group_idx on public.group_role_templates (group_id, position);

create trigger groups_touch before update on public.groups
    for each row execute function public.touch_updated_at();
create trigger group_pinned_posts_touch before update on public.group_pinned_posts
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Helpers (security definer so RLS policies can call them without recursion)
-- ----------------------------------------------------------------------------
create or replace function public.group_role(gid uuid, uid uuid)
returns text language sql stable security definer set search_path = public as $$
    select role from public.group_members where group_id = gid and user_id = uid;
$$;

create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.group_members where group_id = gid and user_id = uid);
$$;

create or replace function public.is_group_admin(gid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(public.group_role(gid, uid) in ('owner', 'admin'), false)
        or public.is_admin(uid);
$$;

-- Public groups are visible to everyone; private ones to members, people
-- with a pending invite, and site admins.
create or replace function public.can_see_group(gid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.groups g where g.id = gid and g.visibility = 'public')
        or public.is_group_member(gid, uid)
        or public.is_admin(uid)
        or exists (
            select 1 from public.group_invites i
            where i.group_id = gid and i.invited_user_id = uid
              and i.kind = 'direct' and i.status = 'pending'
        );
$$;

-- Notify every owner/admin of a group.
create or replace function public.notify_group_admins(
    gid uuid, p_kind text, p_title text, p_body text, p_link text
) returns void language sql security definer set search_path = public as $$
    insert into public.notifications (user_id, kind, title, body, link_url)
    select m.user_id, p_kind, p_title, p_body, p_link
    from public.group_members m
    where m.group_id = gid and m.role in ('owner', 'admin');
$$;

create or replace function public.notify_user(
    uid uuid, p_kind text, p_title text, p_body text, p_link text
) returns void language sql security definer set search_path = public as $$
    insert into public.notifications (user_id, kind, title, body, link_url)
    values (uid, p_kind, p_title, p_body, p_link);
$$;

-- Internal: add a member (idempotent) and close any open request/invite.
create or replace function public._add_group_member(gid uuid, uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    insert into public.group_members (group_id, user_id, role)
    values (gid, uid, 'member')
    on conflict (group_id, user_id) do nothing;

    update public.group_join_requests
        set status = 'approved', decided_at = now()
        where group_id = gid and user_id = uid and status = 'pending';
    update public.group_invites
        set status = 'accepted'
        where group_id = gid and invited_user_id = uid and kind = 'direct' and status = 'pending';
end;
$$;

-- Creator becomes the owner.
create or replace function public.add_group_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.created_by is not null then
        insert into public.group_members (group_id, user_id, role)
        values (new.id, new.created_by, 'owner')
        on conflict (group_id, user_id) do update set role = 'owner';
    end if;
    return new;
end;
$$;

create trigger groups_add_owner after insert on public.groups
    for each row execute function public.add_group_owner();

-- ----------------------------------------------------------------------------
-- Membership actions (called from the app via supabase.rpc)
-- ----------------------------------------------------------------------------

-- Returns 'joined', 'requested', 'member' (already in) or raises.
create or replace function public.join_group(p_group uuid, p_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    g public.groups;
    who text;
begin
    if uid is null then raise exception 'Sign in to join a group.'; end if;
    select * into g from public.groups where id = p_group;
    if not found then raise exception 'Group not found.'; end if;
    if public.is_group_member(p_group, uid) then return 'member'; end if;

    -- A pending direct invite always lets you in, whatever the policy.
    if exists (
        select 1 from public.group_invites
        where group_id = p_group and invited_user_id = uid and kind = 'direct' and status = 'pending'
    ) then
        perform public._add_group_member(p_group, uid);
        return 'joined';
    end if;

    if g.join_policy = 'open' then
        perform public._add_group_member(p_group, uid);
        return 'joined';
    elsif g.join_policy = 'request' then
        if exists (
            select 1 from public.group_join_requests
            where group_id = p_group and user_id = uid and status = 'pending'
        ) then
            return 'requested';
        end if;
        insert into public.group_join_requests (group_id, user_id, message)
        values (p_group, uid, nullif(trim(p_message), ''))
        on conflict do nothing;
        select coalesce(display_name, username) into who from public.profiles where id = uid;
        perform public.notify_group_admins(
            p_group, 'group_join_request',
            who || ' asked to join ' || g.name,
            nullif(trim(p_message), ''),
            '/groups/' || g.slug || '/manage'
        );
        return 'requested';
    else
        raise exception '% is invite only. Ask a group admin for an invite.', g.name;
    end if;
end;
$$;

create or replace function public.cancel_join_request(p_group uuid)
returns void language sql security definer set search_path = public as $$
    update public.group_join_requests set status = 'cancelled', decided_at = now()
    where group_id = p_group and user_id = auth.uid() and status = 'pending';
$$;

create or replace function public.decide_join_request(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
    r public.group_join_requests;
    g public.groups;
begin
    select * into r from public.group_join_requests where id = p_request;
    if not found or r.status <> 'pending' then raise exception 'That request is no longer open.'; end if;
    if not public.is_group_admin(r.group_id, auth.uid()) then raise exception 'Only group admins can do that.'; end if;
    select * into g from public.groups where id = r.group_id;

    if p_approve then
        perform public._add_group_member(r.group_id, r.user_id);
        update public.group_join_requests set decided_by = auth.uid() where id = p_request;
        perform public.notify_user(r.user_id, 'group_join_approved',
            'You''re in ' || g.name, null, '/groups/' || g.slug);
    else
        update public.group_join_requests
            set status = 'declined', decided_by = auth.uid(), decided_at = now()
            where id = p_request;
        perform public.notify_user(r.user_id, 'group_join_declined',
            'Your request to join ' || g.name || ' was declined', null, '/groups');
    end if;
end;
$$;

create or replace function public.invite_member(p_group uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
    g public.groups;
    target uuid;
    who text;
begin
    if not public.is_group_admin(p_group, auth.uid()) then raise exception 'Only group admins can invite.'; end if;
    select * into g from public.groups where id = p_group;
    select id into target from public.profiles where lower(username) = lower(trim(leading '@' from trim(p_username)));
    if target is null then raise exception 'No member called %.', p_username; end if;
    if public.is_group_member(p_group, target) then raise exception '% is already in the group.', p_username; end if;

    -- If they already asked to join, an invite is the same as approving.
    if exists (select 1 from public.group_join_requests where group_id = p_group and user_id = target and status = 'pending') then
        perform public._add_group_member(p_group, target);
        perform public.notify_user(target, 'group_join_approved', 'You''re in ' || g.name, null, '/groups/' || g.slug);
        return;
    end if;

    insert into public.group_invites (group_id, kind, invited_user_id, created_by)
    values (p_group, 'direct', target, auth.uid())
    on conflict do nothing;
    select coalesce(display_name, username) into who from public.profiles where id = auth.uid();
    perform public.notify_user(target, 'group_invite',
        who || ' invited you to ' || g.name, null, '/groups/' || g.slug);
end;
$$;

create or replace function public.decline_invite(p_group uuid)
returns void language sql security definer set search_path = public as $$
    update public.group_invites set status = 'declined'
    where group_id = p_group and invited_user_id = auth.uid() and kind = 'direct' and status = 'pending';
$$;

-- Returns the new token.
create or replace function public.create_invite_link(p_group uuid, p_days int default 14, p_max_uses int default null)
returns text language plpgsql security definer set search_path = public as $$
declare
    t text := replace(gen_random_uuid()::text, '-', '');
begin
    if not public.is_group_admin(p_group, auth.uid()) then raise exception 'Only group admins can make invite links.'; end if;
    insert into public.group_invites (group_id, kind, token, max_uses, expires_at, created_by)
    values (p_group, 'link', t, p_max_uses,
            case when p_days is null then null else now() + make_interval(days => p_days) end,
            auth.uid());
    return t;
end;
$$;

create or replace function public.revoke_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
    select group_id into gid from public.group_invites where id = p_invite;
    if gid is null or not public.is_group_admin(gid, auth.uid()) then raise exception 'Only group admins can do that.'; end if;
    update public.group_invites set status = 'revoked' where id = p_invite and status = 'pending';
end;
$$;

-- Returns the group's slug.
create or replace function public.redeem_invite_link(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare
    i public.group_invites;
    g public.groups;
    who text;
begin
    if auth.uid() is null then raise exception 'Sign in to use an invite link.'; end if;
    select * into i from public.group_invites where token = p_token and kind = 'link' for update;
    if not found or i.status <> 'pending' then raise exception 'This invite link is no longer valid.'; end if;
    if i.expires_at is not null and i.expires_at < now() then raise exception 'This invite link has expired.'; end if;
    if i.max_uses is not null and i.uses >= i.max_uses then raise exception 'This invite link has been used up.'; end if;
    select * into g from public.groups where id = i.group_id;

    if not public.is_group_member(g.id, auth.uid()) then
        perform public._add_group_member(g.id, auth.uid());
        update public.group_invites set uses = uses + 1 where id = i.id;
        select coalesce(display_name, username) into who from public.profiles where id = auth.uid();
        perform public.notify_group_admins(g.id, 'group_member_added',
            who || ' joined ' || g.name || ' with an invite link', null, '/groups/' || g.slug || '/manage');
    end if;
    return g.slug;
end;
$$;

-- What an invite link points at, so /groups/invite/<token> can say
-- "Join <group>" before the visitor redeems it. Never exposes the group's
-- other data or other tokens.
create or replace function public.invite_link_preview(p_token text)
returns table (group_name text, group_slug text, is_valid boolean)
language sql stable security definer set search_path = public as $$
    select g.name, g.slug,
           i.status = 'pending'
           and (i.expires_at is null or i.expires_at > now())
           and (i.max_uses is null or i.uses < i.max_uses)
    from public.group_invites i
    join public.groups g on g.id = i.group_id
    where i.token = p_token and i.kind = 'link';
$$;

create or replace function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    if public.group_role(p_group, auth.uid()) = 'owner' then
        raise exception 'Owners can''t leave. Make someone else the owner first.';
    end if;
    delete from public.group_members where group_id = p_group and user_id = auth.uid();
end;
$$;

-- Owners promote/demote admins and can hand over ownership.
-- Admins can't change roles.
create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
    my_role text := public.group_role(p_group, auth.uid());
    g public.groups;
begin
    if p_role not in ('owner', 'admin', 'member') then raise exception 'Unknown role.'; end if;
    if my_role is distinct from 'owner' and not public.is_admin(auth.uid()) then
        raise exception 'Only the group owner can change roles.';
    end if;
    if not public.is_group_member(p_group, p_user) then raise exception 'They are not in the group.'; end if;
    if p_user = auth.uid() and p_role <> 'owner' and my_role = 'owner' then
        raise exception 'Make someone else the owner first.';
    end if;
    select * into g from public.groups where id = p_group;

    if p_role = 'owner' then
        update public.group_members set role = 'admin' where group_id = p_group and role = 'owner';
    end if;
    update public.group_members set role = p_role where group_id = p_group and user_id = p_user;

    if p_role in ('owner', 'admin') then
        perform public.notify_user(p_user, 'group_role',
            'You''re now ' || (case p_role when 'owner' then 'the owner' else 'an admin' end) || ' of ' || g.name,
            null, '/groups/' || g.slug || '/manage');
    end if;
end;
$$;

create or replace function public.remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
    my_role text := public.group_role(p_group, auth.uid());
    their_role text := public.group_role(p_group, p_user);
begin
    if not public.is_group_admin(p_group, auth.uid()) then raise exception 'Only group admins can remove members.'; end if;
    if their_role = 'owner' then raise exception 'The owner can''t be removed.'; end if;
    if their_role = 'admin' and my_role is distinct from 'owner' and not public.is_admin(auth.uid()) then
        raise exception 'Only the owner can remove an admin.';
    end if;
    delete from public.group_members where group_id = p_group and user_id = p_user;
end;
$$;

revoke execute on function public._add_group_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_group_admins(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_pinned_posts enable row level security;
alter table public.group_role_templates enable row level security;

-- Check the row's own columns first: inside an INSERT ... RETURNING the
-- new row isn't visible to can_see_group's lookup yet.
create policy groups_read on public.groups for select
    using (visibility = 'public' or created_by = auth.uid() or public.can_see_group(id, auth.uid()));
create policy groups_insert on public.groups for insert to authenticated
    with check (created_by = auth.uid());
create policy groups_update on public.groups for update
    using (public.is_group_admin(id, auth.uid()))
    with check (public.is_group_admin(id, auth.uid()));
create policy groups_delete on public.groups for delete
    using (public.group_role(id, auth.uid()) = 'owner' or public.is_admin(auth.uid()));

-- Membership writes go through the functions above.
create policy group_members_read on public.group_members for select
    using (public.can_see_group(group_id, auth.uid()));

create policy group_join_requests_read on public.group_join_requests for select
    using (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

-- Invite tokens are only readable by group admins.
create policy group_invites_read on public.group_invites for select
    using (invited_user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

create policy group_pinned_posts_read on public.group_pinned_posts for select
    using (public.can_see_group(group_id, auth.uid()));
create policy group_pinned_posts_write on public.group_pinned_posts for all
    using (public.is_group_admin(group_id, auth.uid()))
    with check (public.is_group_admin(group_id, auth.uid()));

create policy group_role_templates_read on public.group_role_templates for select
    using (public.can_see_group(group_id, auth.uid()));
create policy group_role_templates_write on public.group_role_templates for all
    using (public.is_group_admin(group_id, auth.uid()))
    with check (public.is_group_admin(group_id, auth.uid()));
