-- ============================================================================
-- 0002_admin_allowlist.sql
-- Hosted Supabase blocks `alter database ... set` even for the postgres
-- role, so the GUC-based allowlist in 0001 doesn't take effect there.
-- Move the allowlist into the function body. To add/remove admins, write
-- a follow-up migration that replaces this function.
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    -- Edit this list (and ship a new migration) to add admins.
    admin_emails constant text[] := array['strepj@gmail.com'];
    base_username text;
    final_username text;
    suffix int := 0;
    is_allowed boolean := false;
begin
    base_username := lower(coalesce(
        nullif(split_part(new.email, '@', 1), ''),
        'user_' || substr(new.id::text, 1, 8)
    ));
    base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
    if base_username = '' then
        base_username := 'user_' || substr(new.id::text, 1, 8);
    end if;

    final_username := base_username;
    while exists (select 1 from public.profiles where username = final_username) loop
        suffix := suffix + 1;
        final_username := base_username || suffix::text;
    end loop;

    if new.email is not null then
        is_allowed := lower(new.email) = any (
            select lower(unnest(admin_emails))
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

-- The 0001 trigger already references this function by name, so no need
-- to recreate the trigger itself.
