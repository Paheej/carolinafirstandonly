-- ============================================================================
-- 0005_archive_pages.sql — Phase 1 content migration
-- archive_pages: unstructured reference content (campaign rules, player hubs,
-- faction docs, FAQ, etc.) that doesn't fit the season/event/recap shape.
--
-- Read by anyone, written by admins only.
-- ============================================================================

create table public.archive_pages (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    title text not null,
    body_md text not null,
    category text,                              -- 's2-reference', 'mechanics', etc.
    display_order int default 0 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create index archive_pages_category_order_idx
    on public.archive_pages (category, display_order);

create trigger archive_pages_touch_updated_at
    before update on public.archive_pages
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.archive_pages enable row level security;

create policy "archive_pages_read_all"
    on public.archive_pages for select using (true);

create policy "archive_pages_admin_all"
    on public.archive_pages for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));
