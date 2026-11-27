-- ============================================================================
-- 0012_profile_guard.sql
--
-- profiles_update_own (0001) lets a user update their whole row, which
-- included is_admin and banned_until: anyone could make themselves an admin
-- from the browser console. This trigger keeps those two columns fixed
-- unless a site admin (or the service role / SQL editor, where auth.uid()
-- is null) is making the change.
-- ============================================================================

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is not null and not public.is_admin(auth.uid()) then
        new.is_admin := old.is_admin;
        new.banned_until := old.banned_until;
    end if;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
    for each row execute function public.guard_profile_update();

-- Usernames are compared case-insensitively (invites, @mentions).
-- Format (3-30 of a-z, 0-9, _) is checked in the app on edit, not here, so
-- the signup trigger's generated names can never fail an insert.
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
