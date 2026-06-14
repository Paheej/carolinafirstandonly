-- ============================================================================
-- 0008_game_systems.sql
--
-- Reference tables that power the system / edition dropdowns when an admin
-- creates or edits a season or special event. seasons.game_system /
-- game_edition stay as free text (cached display values); these tables are
-- the source for the dropdown options + the icon mapping.
-- ============================================================================

create table public.game_systems (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    name text not null,                       -- short display, e.g. "40K"
    icon text not null,                       -- lucide-react PascalCase name
    display_order int default 0 not null,
    created_at timestamptz default now() not null
);

create table public.game_editions (
    id uuid primary key default gen_random_uuid(),
    system_id uuid not null references public.game_systems(id) on delete cascade,
    slug text not null,
    name text not null,                       -- display value, e.g. "10th Edition"
    display_order int default 0 not null,
    created_at timestamptz default now() not null,
    unique (system_id, slug)
);

create index game_editions_system_idx on public.game_editions (system_id, display_order);

alter table public.game_systems  enable row level security;
alter table public.game_editions enable row level security;

create policy "game_systems_read_all"
    on public.game_systems for select using (true);
create policy "game_systems_admin_all"
    on public.game_systems for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

create policy "game_editions_read_all"
    on public.game_editions for select using (true);
create policy "game_editions_admin_all"
    on public.game_editions for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- Seed
-- Icons are lucide-react names. SystemPill in @cfo/ui maps these to the actual
-- icon component (Skull, Swords, Crown, Castle, Scroll, Dices, …).
-- ----------------------------------------------------------------------------

insert into public.game_systems (slug, name, icon, display_order) values
    ('40k',          '40K',           'Skull',  1),
    ('horus-heresy', 'Horus Heresy',  'Swords', 2),
    ('aos',          'Age of Sigmar', 'Crown',  3),
    ('old-world',    'Old World',     'Castle', 4),
    ('wfrp',         'WFRP',          'Scroll', 5),
    ('dnd5e',        'D&D 5e',        'Dices',  6)
on conflict (slug) do nothing;

insert into public.game_editions (system_id, slug, name, display_order)
select s.id, '9th-edition',  '9th Edition',  1 from public.game_systems s where s.slug = '40k'
union all
select s.id, '10th-edition', '10th Edition', 2 from public.game_systems s where s.slug = '40k'
union all
select s.id, '2nd-edition',  '2nd Edition',  1 from public.game_systems s where s.slug = 'horus-heresy'
union all
select s.id, '3rd-edition',  '3rd Edition',  1 from public.game_systems s where s.slug = 'aos'
union all
select s.id, '4th-edition',  '4th Edition',  2 from public.game_systems s where s.slug = 'aos'
union all
select s.id, '4th-edition',  '4th Edition',  1 from public.game_systems s where s.slug = 'wfrp'
on conflict (system_id, slug) do nothing;

-- ----------------------------------------------------------------------------
-- Realign existing event backfill so it matches the seed names.
-- Old Alliances was tagged as "Warhammer / Old World"; the system is now
-- "Old World" with no specific edition row.
-- ----------------------------------------------------------------------------

update public.archive_events
   set game_system = 'Old World',
       game_edition = null
 where slug = 'old-alliances';
