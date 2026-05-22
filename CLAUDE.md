# Carolina First and Only — Build Specification

This document is the source of truth for Claude Code while building the `carolinafirstandonly.com` migration. Keep it in the repo root as `CLAUDE.md` so it's loaded automatically.

---

## Project Overview

Migrate the existing Google Sites-based `carolinafirstandonly.com` to a modern community platform for a Charlotte-area tabletop gaming group (40K-focused, with D&D and other systems represented). The site has three core functions:

1. **Archive** — Campaign and event recaps with admin-reviewed user submissions.
2. **News** — Headless CMS with an AI agent that drafts articles from monitored sources.
3. **Coordination** — User profiles, groups, events with RSVPs, and calendar-based availability.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, strict mode) |
| Runtime | React 19 |
| Styling | Tailwind CSS v4 |
| Database | Supabase Postgres |
| Auth | Supabase Auth (Google, Discord, Apple, email/password fallback) |
| Storage | Supabase Storage for general uploads; Cloudinary for recap photos and on-the-fly transforms |
| Hosting | Vercel (Hobby tier is sufficient) |
| Cron | Vercel Cron |
| AI | Anthropic Claude API (`claude-sonnet-4-5` for drafting) |
| Calendar parsing | `node-ical` for ICS; Google Calendar API and Microsoft Graph for OAuth |
| Fingerprinting | `@fingerprintjs/fingerprintjs` (open-source) |
| Markdown editor | `@uiw/react-md-editor` |
| Markdown render | `react-markdown` + `remark-gfm` |
| Icons | `lucide-react` |
| Package manager | pnpm (workspaces) |

---

## Repository Structure

```
carolinafirstandonly/
├── apps/
│   ├── web/                      # Next.js site
│   └── agent/                    # AI content agent (Vercel serverless + cron)
├── packages/
│   ├── database/                 # Supabase migrations + generated TS types
│   ├── ui/                       # Shared design system components
│   └── shared/                   # Shared types, constants, utilities
├── .github/
│   └── workflows/                # CI: typecheck, build
├── pnpm-workspace.yaml
├── package.json
├── README.md
└── CLAUDE.md                     # this file
```

Both apps consume `@cfo/database`, `@cfo/ui`, and `@cfo/shared`. The agent app is a separate Next.js app (or pure Node) so it can be moved to a different host later if needed.

---

## Design System

**Aesthetic:** "Modern tavern meets wargaming table." Broader hobby vibe — not strictly grimdark, includes D&D and other systems.

### Tokens

```ts
// packages/ui/src/tokens.ts
export const colors = {
  // Backgrounds
  parchment: '#f4ead5',         // light bg
  parchmentDark: '#e8dcc0',     // hover/secondary bg
  ink: '#1a1815',               // primary text
  inkSoft: '#4a4640',           // secondary text

  // Accents
  forest: '#2d4a2b',            // primary brand
  forestDark: '#1f3320',
  brass: '#b08d57',             // accent / CTAs
  brassDark: '#8a6d3f',
  leather: '#6b4423',           // tertiary accent

  // Semantic
  success: '#3f6d3f',
  warning: '#b08d57',
  danger: '#8b2a2a',
  info: '#3a5a78',
};

export const fonts = {
  display: '"EB Garamond", "Cormorant Garamond", Georgia, serif',
  body: 'Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};
```

### Visual Cues
- Subtle parchment/paper texture on backgrounds (use a low-opacity SVG or CSS gradient noise)
- Hex-grid background pattern for hero sections (subtle, low contrast)
- Brass underline accents on headings (1px solid, 4ch wide)
- Group pages can apply a subtle accent color override based on their primary system (40K → blood red highlight; D&D → arcane purple highlight; etc.) — shared scaffolding, different accent

### Component primitives needed in `packages/ui`
- `Button` (variants: primary, secondary, ghost, danger)
- `Card`, `CardHeader`, `CardBody`, `CardFooter`
- `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`
- `Badge` (variants per category/system)
- `Avatar`
- `Modal` / `Dialog`
- `Tabs`
- `MarkdownEditor` (wraps `@uiw/react-md-editor` with our styling)
- `MarkdownRender` (wraps `react-markdown` with our prose styles)
- `NavBar`, `Footer`
- `EmptyState`
- `Skeleton` for loading states

---

## Authentication

Use Supabase Auth with the following providers, all configured via the Supabase dashboard:
- Google OAuth
- Discord OAuth
- Apple Sign-In
- Email/password (fallback)

### Profile auto-creation
On first sign-in, the `/auth/callback` route ensures a row exists in `profiles` keyed to `auth.users.id`. The first sign-in by an email listed in `NEXT_PUBLIC_ADMIN_EMAILS` sets `is_admin = true` (same pattern as the Warhammer Conquest reference repo).

### Visibility model
- **Public (no auth required):** Home, all of `/archive/*`, all of `/news/*` (read), individual public events, public group pages
- **Auth required:** Voting on news, submitting recaps, creating/joining groups, RSVPing, viewing private events, profile/settings, admin areas

---

## Database Schema

All schema lives in `packages/database/supabase/migrations/`. Types are generated to `packages/database/src/types.ts` via `supabase gen types typescript --local`.

### Migration files (build in this order)

`0001_init.sql`
```sql
-- profiles, calendar_connections, user_busy_blocks
-- notifications
-- groups, group_members, group_pinned_posts
-- group_role_templates (for event role defaults)
-- events, event_roles, event_rsvps, event_invites
-- seasons, archive_events, recaps, recap_submissions
-- news_categories, news_posts, news_votes
-- agent_sources, agent_drafts
-- audit_log
```

### Tables (summarized)

```sql
-- IDENTITY -------------------------------------------------------------------
profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  preferred_systems text[],          -- ['40k', 'aos', 'dnd5e', ...]
  is_admin boolean default false,
  created_at timestamptz default now()
)

calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  provider text check (provider in ('google','outlook','apple_ics')),
  encrypted_refresh_token text,       -- nullable for apple_ics
  ics_url text,                       -- nullable for OAuth providers
  last_synced_at timestamptz,
  enabled boolean default true,
  unique (user_id, provider)
)

user_busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source_provider text not null,
  source_hash text,                   -- de-dupe key
  synced_at timestamptz default now()
)
create index on user_busy_blocks (user_id, starts_at, ends_at);

-- NOTIFICATIONS (in-app feed) ------------------------------------------------
notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  kind text not null,                 -- 'event_rsvp', 'recap_approved', 'news_published', etc.
  title text not null,
  body text,
  link_url text,
  read_at timestamptz,
  created_at timestamptz default now()
)
create index on notifications (user_id, created_at desc);

-- GROUPS ---------------------------------------------------------------------
groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description_md text,
  systems text[],                     -- ['40k', 'dnd5e']
  visibility text check (visibility in ('public','private')) default 'public',
  banner_url text,
  accent_color text,                  -- optional per-group accent
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('owner','admin','member')) default 'member',
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
)

group_pinned_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  author_id uuid references profiles(id),
  title text not null,
  body_md text not null,
  position int default 0,             -- ordering
  created_at timestamptz default now()
)

group_role_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  role_name text not null,
  default_max int
)

-- EVENTS ---------------------------------------------------------------------
events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description_md text,
  group_id uuid references groups(id) on delete set null,  -- null = standalone
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  visibility text check (visibility in ('public','group','hidden')) default 'public',
  capacity int,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

event_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  role_name text not null,
  max_count int,
  unique (event_id, role_name)
)

event_rsvps (
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text check (status in ('yes','no','maybe','waitlist')) not null,
  role_id uuid references event_roles(id),
  waitlist_position int,
  rsvped_at timestamptz default now(),
  primary key (event_id, user_id)
)

event_invites (
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invited_by uuid references profiles(id),
  primary key (event_id, user_id)
)

-- ARCHIVE --------------------------------------------------------------------
seasons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  year int,
  description_md text,
  hero_image_url text,
  starts_on date,
  ends_on date,
  display_order int
)

archive_events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  event_date date,
  description_md text,
  hero_image_url text,
  season_id uuid references seasons(id),
  display_order int
)

recaps (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  season_id uuid references seasons(id),
  archive_event_id uuid references archive_events(id),
  title text not null,
  body_md text not null,
  photos jsonb default '[]'::jsonb,   -- [{url, caption, cloudinary_id}]
  author_id uuid references profiles(id),
  published_at timestamptz,
  check (season_id is not null or archive_event_id is not null)
)

recap_submissions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id),
  archive_event_id uuid references archive_events(id),
  title text not null,
  body_md text not null,
  photos jsonb default '[]'::jsonb,
  author_id uuid references profiles(id) on delete cascade,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  reviewed_by uuid references profiles(id),
  review_notes text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz
)

-- NEWS -----------------------------------------------------------------------
news_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  display_order int
)

news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body_md text not null,
  excerpt text,
  category_id uuid references news_categories(id),
  tags text[],
  source_url text,                    -- the originating article (for AI drafts)
  author_id uuid references profiles(id),   -- null = AI-drafted, then edited by admin
  status text check (status in ('draft','published','archived')) default 'draft',
  published_at timestamptz,
  upvotes int default 0,
  downvotes int default 0,
  hot_score double precision default 0,
  created_at timestamptz default now()
)
create index on news_posts (status, published_at desc);
create index on news_posts (hot_score desc) where status = 'published';

news_votes (
  post_id uuid references news_posts(id) on delete cascade,
  fingerprint_hash text not null,
  vote smallint check (vote in (-1, 1)) not null,
  ip_hash text,                       -- secondary signal, also hashed
  created_at timestamptz default now(),
  primary key (post_id, fingerprint_hash)
)

-- Trigger: when news_votes changes, recompute upvotes/downvotes/hot_score on news_posts.

-- AI AGENT -------------------------------------------------------------------
agent_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text check (source_type in ('rss','youtube','web_scrape')) not null,
  url text not null,
  channel_id text,                    -- for youtube
  enabled boolean default true,
  default_category_id uuid references news_categories(id),
  default_tags text[],
  last_run_at timestamptz,
  created_at timestamptz default now()
)

agent_drafts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references agent_sources(id) on delete cascade,
  source_url text not null unique,    -- de-dupe
  source_title text,
  source_published_at timestamptz,
  raw_excerpt text,                   -- the content we summarized
  draft_title text not null,
  draft_body_md text not null,
  suggested_category_id uuid references news_categories(id),
  suggested_tags text[],
  newsworthiness smallint,            -- 1-5
  status text check (status in ('draft','published','discarded')) default 'draft',
  published_post_id uuid references news_posts(id),
  created_at timestamptz default now()
)

-- AUDIT ----------------------------------------------------------------------
audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
)
```

### RLS Policies

Follow the Warhammer Conquest pattern. Key principles:

- Anyone can read: `seasons`, `archive_events`, `recaps` (where `published_at is not null`), `news_posts` (where `status = 'published'`), `news_categories`, public `groups`, public `events`
- Authenticated users can:
  - Insert their own `recap_submissions`
  - Read/update/delete their own `profiles`, `calendar_connections`, `notifications`, `event_rsvps`
  - Insert `groups` (anyone authed)
  - Read groups they're members of and public groups
  - RSVP to events they can see
- Admins (where `profiles.is_admin = true`):
  - Full read/write on everything
  - Approve recap submissions (status change)
  - Publish news posts (status change)
  - Manage `agent_sources`
- Triggers run with `security definer` where needed for vote counting and waitlist promotion

### Triggers / Functions

```sql
-- 1. Vote aggregation
create function update_news_vote_counts() returns trigger as $$ ... $$;
-- Recomputes upvotes/downvotes/hot_score on news_posts after insert/update/delete on news_votes.

-- 2. Hot score (Reddit-style, time-decayed)
create function calculate_hot_score(ups int, downs int, created timestamptz) returns double precision as $$
  -- score = (ups - downs) / power(extract(epoch from now() - created)/3600 + 2, 1.8)
$$;

-- 3. Recap submission approval
create function publish_recap_on_approval() returns trigger as $$ ... $$;
-- When recap_submissions.status transitions to 'approved', insert into recaps with published_at = now().

-- 4. Waitlist promotion
create function promote_waitlist_on_drop() returns trigger as $$ ... $$;
-- When an event_rsvp goes yes -> no/cancelled, promote the earliest waitlisted RSVP.

-- 5. Notification fan-out
create function notify_event_rsvp_change() returns trigger as $$ ... $$;
-- Insert into notifications when relevant changes happen.

-- 6. Profile auto-create
create function ensure_profile_on_auth() returns trigger as $$ ... $$;
-- After auth.users insert, create matching profiles row, set is_admin if email is in admin allowlist.
```

---

## Routes

```
apps/web/app/
├── page.tsx                            # Home: hero, recent news, upcoming events
├── archive/
│   ├── page.tsx                        # Index: seasons + events grid
│   ├── seasons/[slug]/page.tsx         # Season detail + recap list
│   ├── events/[slug]/page.tsx          # Special event detail + recap list
│   ├── recaps/[slug]/page.tsx          # Individual recap
│   ├── submit/page.tsx                 # Auth-gated submission form
│   └── pending/page.tsx                # Admin review queue
├── news/
│   ├── page.tsx                        # Feed with hot/top/new toggle
│   ├── [slug]/page.tsx                 # Article detail
│   └── admin/
│       ├── page.tsx                    # Admin dashboard
│       ├── drafts/page.tsx             # AI drafts queue
│       ├── drafts/[id]/page.tsx        # Draft editor
│       ├── new/page.tsx                # Manual post composer
│       └── sources/page.tsx            # Configure agent sources
├── groups/
│   ├── page.tsx                        # Discoverable directory (public groups only for non-auth)
│   ├── new/page.tsx                    # Create group (auth)
│   ├── [slug]/
│   │   ├── page.tsx                    # Group page (auth required)
│   │   ├── members/page.tsx
│   │   ├── events/page.tsx
│   │   └── settings/page.tsx           # Owner/admin only
├── events/
│   ├── page.tsx                        # Upcoming (filtered by user)
│   ├── new/page.tsx                    # Create event
│   └── [id]/page.tsx                   # Event detail + RSVP
├── profile/
│   ├── page.tsx                        # Own profile
│   ├── settings/page.tsx               # Calendar connections, auth providers
│   ├── notifications/page.tsx          # In-app notification feed
│   └── [username]/page.tsx             # Public profile
├── auth/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── callback/route.ts
├── admin/
│   ├── page.tsx                        # Admin dashboard
│   ├── users/page.tsx
│   └── audit/page.tsx
├── api/
│   ├── votes/route.ts                  # POST: cast/change vote (rate limited)
│   ├── calendar-sync/route.ts          # POST: trigger user calendar sync
│   ├── availability/route.ts           # GET: aggregated availability for a group + time window
│   └── webhooks/cloudinary/route.ts
├── layout.tsx
└── globals.css

apps/agent/app/
├── api/
│   ├── cron/run/route.ts               # Vercel Cron entrypoint (daily 6am)
│   └── trigger/route.ts                # Manual trigger (admin only)
└── lib/
    ├── fetchers/{rss,youtube,scrape}.ts
    ├── claude.ts                       # Anthropic API client
    ├── pipeline.ts                     # source -> raw -> draft flow
    └── dedupe.ts
```

---

## Feature Specs

### Archive

- Three 40K seasons + three special events seeded from Google Sites content (manually migrated, restructured)
- Also migrate ancillary content (roster pages, house rules, photo galleries) as recaps or standalone pages
- **Recap submission flow:**
  - `/archive/submit` shows a form: select season OR archive_event, title, markdown body (with `MarkdownEditor`), photo uploader (Cloudinary widget — multiple, with captions)
  - Submit → row in `recap_submissions`, status `pending`, notify all admins via in-app notification
  - `/archive/pending` (admin only) shows the queue: each submission renders with full preview, "Approve" (publishes immediately), "Reject" (with required note), "Edit then Approve" (opens editor)
  - On approve: trigger creates `recaps` row, notifies submitter
- **Photo handling:** Cloudinary signed upload preset, max 10 photos per recap, max 8MB each. Server-side validation of MIME type.

### News

- **Public feed at `/news`:**
  - Toggle: Hot (default) / Top (all-time) / New (chronological)
  - Filter by category and tag
  - Each post card shows: title, excerpt, category badge, source link if AI-drafted (small "via" indicator), vote count, comment count (skip comments v1)
  - Pagination: cursor-based, 20 per page
- **Anonymous voting:**
  - Client: load FingerprintJS, generate visitor ID on first load, store in httpOnly cookie via `/api/votes` POST
  - Server: hash `fingerprint + secret` (HMAC) before storage. Also hash IP for secondary signal.
  - One vote per (post_id, fingerprint_hash) — DB unique constraint enforces
  - Rate limit: 30 votes per IP per 10 minutes (Vercel KV or in-memory map for v1)
  - Vote toggles: clicking same direction removes, clicking opposite changes
- **Hot score:** Reddit-style time decay. Recomputed on every vote change. Indexed.

### AI Agent

**Configured sources (seed these in `0002_seed_sources.sql`):**

| Name | Type | URL / Channel |
|---|---|---|
| Goonhammer | RSS | `https://www.goonhammer.com/feed/` |
| Warhammer Community | RSS | `https://www.warhammer-community.com/feed/` |
| Bell of Lost Souls | RSS | `https://www.belloflostsouls.net/feed` |
| Spikey Bits | RSS | `https://spikeybits.com/feed` |
| The Miniatures Page | web_scrape | `https://theminiaturespage.com/news/` |
| DakkaDakka News | web_scrape | `https://www.dakkadakka.com/dakkaforum/forums/show/1.page` |
| Bolter and Chainsword | web_scrape | `https://www.bolterandchainsword.com/` |
| Chapter Valrak | youtube | (resolve channel ID at setup) |
| Auspex Tactics | youtube | (resolve channel ID at setup) |
| PlayOn Tabletop | youtube | (resolve channel ID at setup) |
| Paul Is Bad at Stuff | youtube | (resolve channel ID at setup) |
| Tabletop Gaming - The Australia Channel | youtube | (resolve channel ID at setup) |
| Pro Acryl | youtube | (resolve channel ID at setup) |

**YouTube channel IDs need to be resolved at setup time. Build a one-off script `scripts/resolve-youtube-channels.ts` that takes channel handles/URLs and resolves to channel IDs via the YouTube Data API.**

**Pipeline:**

1. **Trigger:** Vercel Cron daily at 6am ET (`0 11 * * *` UTC) hits `/api/cron/run` on the agent app. Manual trigger via admin UI hits `/api/trigger` (auth-gated).
2. **Fetch:** For each enabled source:
   - RSS → parse with `rss-parser`, get items since `last_run_at`
   - YouTube → YouTube Data API `playlistItems.list` on uploads playlist since `last_run_at`; fetch video description and captions if available
   - Web scrape → fetch HTML, extract main content with `@mozilla/readability`, dedupe by URL
3. **Dedupe:** Skip any item whose `source_url` exists in `agent_drafts` already.
4. **Summarize:** For each new item, call Claude API:
   ```
   System: You are a content curator for a tabletop wargaming community newsletter
   (Carolina First and Only — primarily 40K, also AoS, D&D, and other systems).
   Read the source content and produce a draft newsletter item.

   User: [source content, max 8000 tokens]

   Respond ONLY in valid JSON with this schema:
   {
     "title": "string (under 80 chars, no clickbait)",
     "body_md": "string (2-4 short paragraphs, markdown, includes an in-context link to source)",
     "excerpt": "string (under 200 chars)",
     "suggested_category": "official_news|tactics|painting|lore|community|industry|battle_report",
     "suggested_tags": ["string"],
     "newsworthiness": 1-5,
     "is_relevant": boolean
   }
   ```
5. **Filter:** If `is_relevant: false` or `newsworthiness < 2`, discard.
6. **Store:** Insert into `agent_drafts` with `status = 'draft'`.
7. **Notify:** Insert in-app notification for admins ("N new drafts ready for review").
8. **Update:** Set `agent_sources.last_run_at = now()`.

**Cost guardrails:**
- Per-run cap: 15 drafts max (skip oldest if over)
- Per-month token budget tracked in `audit_log` — alert when crossing $20/month
- Use `claude-sonnet-4-5` for the draft pass; consider `claude-haiku-4-5` for the relevance filter if cost becomes an issue

**Admin review at `/news/admin/drafts`:**
- List of drafts, sortable by newsworthiness/date/source
- Click a draft → editor view: source link (preview), suggested metadata, full markdown editor pre-filled with `draft_body_md`
- Actions: "Publish" (creates `news_posts` row with status `published`, sets `agent_drafts.status = 'published'` and links via `published_post_id`), "Save Draft" (keeps editing later), "Discard" (sets `status = 'discarded'`)

### Groups

- Anyone authed can create a group at `/groups/new` (slug, name, description, systems multi-select, visibility, banner)
- Creator becomes `owner`. Owner can promote members to `admin`. Admins can edit group settings, kick members, pin posts.
- Public groups visible to all; private groups only to members
- `/groups/[slug]` shows: banner, description, member count, upcoming group events, pinned posts, member list
- Group settings allow defining `group_role_templates` — e.g., D&D group sets default roles "GM" (max 1), "Player" (max 5). These become defaults when creating events in this group; can be overridden per event.

### Events

- Create at `/events/new` (or `/groups/[slug]/events/new` — preselects group)
- Fields: title, description (markdown), starts_at, ends_at, location, optional group, visibility (public/group/hidden), capacity, roles
- If group is set: roles default to group's role template; organizer can edit
- **Visibility:**
  - `public`: anyone can see and RSVP
  - `group`: only group members can see
  - `hidden`: only invited users can see; organizer adds invites by username
- **RSVP flow:**
  - User picks status (yes/no/maybe) and role
  - If role has `max_count` and is full, user can join the waitlist for that role specifically (set `status = 'waitlist'` + `role_id` + computed `waitlist_position`)
  - On someone going from `yes` → `no`/cancelled, trigger promotes earliest waitlisted RSVP to `yes` for same role
- **Availability helper:** When creating an event with a group selected and a proposed time window, the form fetches `/api/availability?group_id=X&start=Y&end=Z` and renders an aggregated grid: "5 of 8 group members available." Optional: members can expand to see anonymized busy/free blocks per person if they opt in.

### Calendar Integration (read-only at launch)

- **Google Calendar:**
  - User clicks "Connect Google Calendar" in settings → OAuth flow with scope `calendar.readonly`
  - Store encrypted refresh token in `calendar_connections`
  - Daily Vercel Cron job at 2am ET (`0 7 * * *` UTC) fetches free/busy info for next 90 days per connected user; writes to `user_busy_blocks`
  - Only busy windows stored; no event titles, no descriptions, no locations
- **Microsoft/Outlook:**
  - Same flow via Microsoft Graph API, scope `Calendars.Read`
- **Apple/iCloud:**
  - No OAuth available. User generates a private ICS subscription URL in iCloud (Calendar.app → Calendar Info → "Public Calendar") and pastes it into settings
  - Daily cron fetches the ICS, parses with `node-ical`, writes busy blocks
- **Two-way sync deferred to Phase 2.**

### Notifications (in-app)

- `/profile/notifications` shows a feed of `notifications` rows for the current user
- Bell icon in nav with unread count badge
- Triggered events:
  - Recap submitted (admins notified)
  - Recap approved/rejected (submitter notified)
  - New AI drafts ready (admins notified)
  - Someone RSVPed to your event (organizer notified)
  - You were invited to a hidden event
  - You were promoted off the waitlist
  - You were added to a group
- Mark-as-read on click; bulk "mark all read" action

### Admin

- Promoted via `NEXT_PUBLIC_ADMIN_EMAILS` env var, comma-separated
- `/admin` dashboard: pending recap count, draft news count, recent signups, agent run history
- `/admin/users`: search, demote/promote, ban (sets `banned_until` — add this field to profiles)
- `/admin/audit`: paginated audit log

---

## Public-Facing Visibility Matrix

| Route | Public | Authed | Group Member | Admin |
|---|---|---|---|---|
| `/` | ✅ | ✅ | ✅ | ✅ |
| `/archive/*` (read) | ✅ | ✅ | ✅ | ✅ |
| `/archive/submit` | 🔒 | ✅ | ✅ | ✅ |
| `/archive/pending` | 🔒 | 🔒 | 🔒 | ✅ |
| `/news` (read) | ✅ | ✅ | ✅ | ✅ |
| `/news` (vote) | ✅ | ✅ | ✅ | ✅ |
| `/news/admin/*` | 🔒 | 🔒 | 🔒 | ✅ |
| `/groups` (public dir) | ✅ | ✅ | ✅ | ✅ |
| `/groups/new` | 🔒 | ✅ | ✅ | ✅ |
| `/groups/[slug]` public | 🔒 (preview only) | ✅ | ✅ | ✅ |
| `/groups/[slug]` private | 🔒 | 🔒 | ✅ | ✅ |
| `/events/[id]` public | ✅ | ✅ | ✅ | ✅ |
| `/events/[id]` group | 🔒 | 🔒 | ✅ | ✅ |
| `/events/[id]` hidden | 🔒 | 🔒 (only invitees) | 🔒 (only invitees) | ✅ |
| `/profile/*` | 🔒 | ✅ (own) | ✅ (own) | ✅ |

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only

# Admin allowlist
NEXT_PUBLIC_ADMIN_EMAILS=you@example.com

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
CLOUDINARY_API_KEY=                 # server-only
CLOUDINARY_API_SECRET=              # server-only

# OAuth providers (configured in Supabase, but agent needs Google for calendar)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Encryption for stored refresh tokens
TOKEN_ENCRYPTION_KEY=               # 32-byte base64, used for AES-GCM

# Voting
FINGERPRINT_HMAC_SECRET=            # 32-byte random, for hashing fingerprints + IPs

# AI Agent
ANTHROPIC_API_KEY=
YOUTUBE_API_KEY=

# Site URL
NEXT_PUBLIC_SITE_URL=https://carolinafirstandonly.com
```

---

## Build Order (Suggested for Claude Code)

Each phase produces a shippable increment. Run typecheck after each.

**Phase 0 — Foundation (1 PR)**
- `pnpm init` workspaces, scaffold both apps and three packages
- Set up Supabase local dev (`supabase init`, `supabase start`)
- Add `0001_init.sql` with profiles, notifications, audit_log tables
- Set up the design system in `packages/ui`: tokens, base primitives (Button, Card, Input, NavBar, Footer)
- Set up the Next.js shell in `apps/web`: layout, globals.css, home page with placeholder hero
- Configure Supabase auth providers (env scaffold + callback route)
- Smoke test: sign in with email, verify profile is created, see admin link if email matches allowlist

**Phase 1 — Archive**
- Schema: seasons, archive_events, recaps, recap_submissions
- Seed migration with the three seasons and three events (manually port content from Google Sites)
- Public read routes: `/archive`, `/archive/seasons/[slug]`, `/archive/events/[slug]`, `/archive/recaps/[slug]`
- Auth-gated `/archive/submit` with MarkdownEditor and Cloudinary photo upload
- Admin `/archive/pending` with approve/reject/edit flow
- Notification triggers wired up

**Phase 2 — Groups + Profiles**
- Schema: groups, group_members, group_pinned_posts, group_role_templates
- `/profile/[username]` and `/profile/settings`
- `/groups`, `/groups/new`, `/groups/[slug]`, settings page
- Pinned posts CRUD on group pages

**Phase 3 — Events + RSVPs**
- Schema: events, event_roles, event_rsvps, event_invites
- `/events/new` with group selector and role config
- `/events/[id]` with RSVP, waitlist, role selection
- Waitlist promotion trigger
- Hidden event invite management

**Phase 4 — Calendar + Availability**
- Schema: calendar_connections, user_busy_blocks
- Google OAuth flow in `/profile/settings`
- Outlook OAuth flow
- Apple ICS URL input
- Daily Vercel Cron for syncing
- `/api/availability` endpoint
- Availability heatmap component on event creation

**Phase 5 — News + Voting**
- Schema: news_categories, news_posts, news_votes
- Public `/news` feed with hot/top/new toggle
- Individual article page
- Anonymous voting with FingerprintJS + rate limiting
- Admin manual composer at `/news/admin/new`

**Phase 6 — AI Agent**
- Schema: agent_sources, agent_drafts
- Seed sources from the list above
- Resolve YouTube channel IDs (one-off script)
- Fetchers for RSS, YouTube, web scrape
- Claude API integration with structured JSON output
- Daily cron + manual trigger
- Admin draft review UI

**Phase 7 — Polish + Launch**
- Audit log UI
- Skeleton loading states everywhere
- Error boundaries and toast notifications
- Sitemap + robots.txt + OpenGraph metadata
- Lighthouse pass (aim for >90 on all but maybe perf if image-heavy)
- DNS cutover to Vercel

---

## Open Items the Builder Should Surface

When Claude Code hits these, pause and confirm with the user:

1. **Google Sites content extraction:** Google Sites has no clean export. Plan: take the publicly rendered HTML, write a one-off `scripts/migrate-google-site.ts` that uses Playwright to render each page, extracts main content, converts to markdown via `turndown`, and outputs structured JSON for manual review before seeding. Confirm with user whether they'd rather do this manually section-by-section or trust the automated pass.

2. **Apple Sign-In setup:** Requires an Apple Developer account ($99/year) and several certs. If the user doesn't already have one, defer Apple auth to Phase 2 and launch with Google + Discord + email.

3. **Cloudinary vs. Supabase Storage:** Cloudinary's free tier is generous (25 credits/month) but requires an account and adds a vendor. Alternative is just Supabase Storage + Next.js `<Image>` for transforms. Confirm Cloudinary is wanted before building the upload widget.

4. **YouTube transcript availability:** Not all videos have captions. For videos without them, the agent can fall back to description-only summarization but quality drops. Document this in the source's UI.

5. **News categories seed list:** I'm assuming `official_news`, `tactics`, `painting`, `lore`, `community`, `industry`, `battle_report`. Confirm with user before seeding.

6. **Admin email allowlist:** Confirm the initial email(s).

7. **Notification model:** Spec says in-app feed only for v1. Confirm before building any email infra.

---

## Conventions

- TypeScript strict mode everywhere
- Server components by default; mark client components explicitly
- All database access goes through `packages/database` — never inline a Supabase query in a route file
- Generated types are committed to the repo; regenerate after every migration
- Migrations are append-only and named `NNNN_descriptive_name.sql`
- All times in UTC in the DB; convert at render
- All user-facing markdown is sanitized via `react-markdown`'s default safe behavior; no `dangerouslySetInnerHTML` ever
- Server actions for mutations; route handlers only for things that genuinely need an HTTP API
- Rate limit anything anonymous (voting, public form submits)

---

## What I'd Build First (2-Week Spike)

To validate the architecture before committing to all 7 phases:

- Phase 0 in full
- Phase 1 (Archive) in full
- A landing page that nails the aesthetic direction

If the design and submission flow feel right after week 2, the rest of the phases can proceed with confidence.
