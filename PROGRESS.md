# Build Progress

A running log of what's been shipped, where things live, and the gotchas
that bit us. Read this **after** `CLAUDE.md` (which is the source-of-truth
spec) before starting a new phase.

---

## Phase 0 — Foundation ✅

**Shipped 2026-05-22.** Smoke-tested end-to-end: signup → profile auto-create
→ admin allowlist match → admin chip rendered.

### What's actually in the repo

| Area | State |
|---|---|
| pnpm workspaces (`apps/{web,agent}` + `packages/{database,ui,shared}`) | ✅ |
| `apps/web` Next.js 15 shell — layout, home, `/auth/{login,signup,callback}`, `/api/auth/signout`, `/profile`, `not-found` | ✅ |
| `apps/agent` placeholder — `/api/cron/run`, `/api/trigger` both return 501 | ✅ |
| `packages/database` — `0001_init.sql` (profiles, notifications, audit_log + RLS + ensure_profile_on_auth trigger), `0002_admin_allowlist.sql` (function-embedded allowlist) | ✅ |
| `packages/database` Supabase SSR clients — `browser.ts`, `server.ts`, `middleware.ts`, plus `createServiceSupabase()` for service-role calls | ✅ |
| `packages/ui` design system — `Button`, `Card+sub`, `Input/Textarea/Label`, `NavBar`, `Footer`, `Container`, `Badge`, `Skeleton`, tokens, `styles.css` | ✅ |
| `packages/shared` — `cn`, `SITE_NAME`, `GAME_SYSTEMS`, `NEWS_CATEGORIES`, `adminEmails()`, `isAdminEmail()` | ✅ |
| Mobile-friendly nav with hamburger drawer | ✅ |
| `.github/workflows/ci.yml` — typecheck + build both apps | ✅ |

### Routes that exist
```
/                       home (hero + 3 pillars + 2 campaign cards + Phase 0 banner)
/auth/login
/auth/signup
/auth/callback          PKCE code exchange
/api/auth/signout
/profile                placeholder, requires auth
/_not-found
```

Stubs for Phase 6:
```
agent/api/cron/run      → 501 not_implemented
agent/api/trigger       → 501 not_implemented
```

---

## Environment & infrastructure decisions

### Supabase — hosted, not local
- **No Docker / Colima / OrbStack on this machine.** Chose the hosted
  Supabase project over installing a container runtime.
- Project ref: `ffzmongphrwovudnrhwv` (region us-east). Postgres 17.
- Linked via `supabase link --project-ref ffzmongphrwovudnrhwv` from
  `packages/database`. Push migrations with:
  ```bash
  SUPABASE_DB_PASSWORD=<pwd> supabase db push --workdir packages/database
  ```
- `pnpm db:start/stop/reset` scripts in `package.json` assume local — they
  won't work in this environment. Use `db push` instead.
- Types are regenerated with:
  ```bash
  supabase gen types typescript --project-id ffzmongphrwovudnrhwv --schema public \
    > packages/database/src/types.generated.ts
  ```
  This works without `supabase login`. Hand-written `types.ts` is kept as
  the canonical import path — swap it for `types.generated.ts` once we
  trust the generator's shape (not yet wired).

### Where env vars live
- **`.env.local` is in `apps/web/`, NOT at the workspace root.** Next.js
  only reads env files from the app directory. The first attempt put it
  at the root and middleware errored with "Your project's URL and Key are
  required to create a Supabase client".
- The `agent` app would need its own `apps/agent/.env.local` when Phase 6
  comes online.

### Auth providers
- Email/password works (with confirmations toggled OFF in the Supabase
  dashboard during the Phase 0 smoke test).
- Google / Discord buttons are rendered in the auth form but the
  corresponding providers are **not yet enabled in the Supabase dashboard**.
- Apple Sign-In requires an Apple Developer account ($99/yr) — deferred.
  Button is shown as disabled "(coming soon)".

### Admin allowlist
- The spec says "promote via `NEXT_PUBLIC_ADMIN_EMAILS` env var" but
  hosted Supabase **blocks `alter database ... set` even for the postgres
  role**, so the GUC-based pattern in `0001_init.sql` is dead on arrival.
- Migration `0002_admin_allowlist.sql` hardcodes the allowlist inside
  `handle_new_auth_user()`:
  ```sql
  admin_emails constant text[] := array['strepj@gmail.com'];
  ```
  To add/remove admins, write a new migration that recreates the function.
- The env var `NEXT_PUBLIC_ADMIN_EMAILS` is still set in `.env.local` and
  read by `isAdminEmail()` in `@cfo/shared`, but it's no longer the source
  of truth for the trigger — the function is.

---

## Gotchas to not relearn

### 1. Tailwind v4 `@source` path is relative to the CSS file
`apps/web/app/globals.css` needs **three** `../` to reach the workspace
root and find `packages/ui`:
```css
@source "../../../packages/ui";
```
Two `../` resolves to `apps/packages/ui` (nonexistent). Tailwind silently
finds nothing and any utility class used inside `packages/ui` (e.g.
`md:flex`, `sticky`, `h-7`, `text-[11px]`) is missing from the generated
CSS. Symptom: things look unstyled even though `@layer components`
classes (defined in CSS) still work.

### 2. Tailwind v4 arbitrary `shadow-[]` with commas inside `rgba()` breaks
Tailwind's parser splits on commas without respecting parens. So this:
```tsx
className="shadow-[0_2px_0_0_var(--color-forest-dark),0_4px_10px_-2px_rgba(31,51,32,0.35)]"
```
gets dropped silently. Hover/active states never apply.

**Fix:** define button styles as real CSS in `@layer components`
(see `.cfo-btn--primary` et al. in `packages/ui/src/styles.css`) and
have `Button.tsx` apply the class. Same goes for any other multi-shadow
declarations.

### 3. Hosted Supabase strips superuser privileges
Migrations that work locally but fail on hosted:
- `alter database ... set <guc>` — blocked, raises `insufficient_privilege`
- Likely also: `create extension` for non-allowlisted extensions, `alter
  system`, anything touching `pg_*` system catalogs

If a migration needs config, embed it in a function body or write to a
table. The `0001_init.sql` migration catches the alter-database failure
with a `raise notice` so it doesn't abort the rest.

### 4. SSR cookie API: use `getAll`/`setAll`, not `get`/`set`/`remove`
`@supabase/ssr@0.5.x` accepts both the deprecated three-method API and
the new `getAll`/`setAll` API as a discriminated union. TypeScript can't
infer which one you're implementing from inline callbacks → implicit-any
errors on the parameter. Either type them explicitly or use the new
API (we chose the new one — see `packages/database/src/server.ts`).

### 5. Next.js auto-edits `tsconfig.json` and `next-env.d.ts` on first build
Don't be alarmed when `allowJs: true` and a `<reference path>` line appear
after the first `next build`. Those are Next-added; leave them in.

---

## What's NOT done (deferred to later phases)

These are intentional — they're either Phase-1+ work or unblocked-but-not-needed:

- Real schema for `seasons`, `archive_events`, `recaps`, `recap_submissions`,
  `groups`, `events`, `news_*`, `agent_*`, `calendar_*` — **Phase 1+**.
- Generated DB types haven't replaced the hand-written `types.ts` yet
  (no schema churn justifies the swap yet).
- OAuth providers (Google, Discord) not enabled in Supabase dashboard.
- Cloudinary not wired (Phase 1 photo upload).
- Anthropic API not called (Phase 6 agent).
- No Vercel deployment yet — site is local-only. DNS cutover is Phase 7.

---

## Open items the next phase needs decided

From `CLAUDE.md`'s "Open Items the Builder Should Surface" — these are the
ones Phase 1 should resolve before starting:

1. **Cloudinary vs Supabase Storage.** Spec leans Cloudinary for photos
   with on-the-fly transforms. Confirm before building the recap photo
   uploader.
2. **Google Sites content extraction.** Three seasons + three events
   need to come over. Playwright scrape → markdown vs. manual port?
   The user has the source site; they may have a preference here.
3. (Phase 5+) News categories seed list — assumed to be
   `official_news, tactics, painting, lore, community, industry,
   battle_report`. Confirm before seeding.

---

## How to start a new conversation for Phase 1

In the new session, this is what to load and in what order:

1. `CLAUDE.md` (auto-loaded — it's the source-of-truth spec)
2. `PROGRESS.md` (this file — current state + gotchas)
3. `README.md` (commands + setup)

Then look at:
- `packages/ui/src/index.ts` to see what primitives already exist
- `packages/database/supabase/migrations/` to see what's been applied
- `apps/web/app/page.tsx` for the design-system reference rendering

Phase 1 starting point:
- Add migration `0003_archive.sql` with `seasons`, `archive_events`,
  `recaps`, `recap_submissions` per the spec
- Decide Cloudinary vs. Supabase Storage (ask the user)
- Add the markdown-render + markdown-editor primitives to `@cfo/ui`
  (`MarkdownRender` wrapping `react-markdown` + `remark-gfm`,
  `MarkdownEditor` wrapping `@uiw/react-md-editor`)
- Build the public read routes first (`/archive`, season/event/recap
  detail pages) with placeholder seed data so the design lands before
  the user-submission flow
- Then `/archive/submit` (auth-gated) and `/archive/pending` (admin-only)
