# Build Progress

A running log of what's been shipped, where things live, and the gotchas
that bit us. Read this **after** `CLAUDE.md` (which is the source-of-truth
spec) before starting a new phase.

---

## Phase 1 — Archive ✅

**Shipped 2026-05-23.** Builds + typechecks clean. Public archive renders
with seeded shells; the recap submission and admin review queue are wired
end-to-end but pending real content/photos to exercise.

### What's actually in the repo

| Area | State |
|---|---|
| `packages/database` migrations `0003_archive.sql` (seasons, archive_events, recaps, recap_submissions + RLS + slugify/unique_recap_slug helpers + `publish_recap_on_approval` + `notify_admins_on_recap_submission` + `notify_submitter_on_recap_review` + `touch_updated_at`), `0004_seed_archive_shells.sql` (3 season + 3 event shells with placeholder markdown) | ✅ |
| `packages/database/src/types.ts` extended with seasons/archive_events/recaps/recap_submissions and `RecapPhoto`. **Important:** every table now carries `Relationships: []` — without it, postgrest-js v2.106 silently degrades query types to `never` | ✅ |
| `packages/ui` — `MarkdownRender` (react-markdown + remark-gfm, no rehype-raw, sanitized by default) + `MarkdownEditor` (`@uiw/react-md-editor` via `next/dynamic`, ssr: false) + parchment `.cfo-prose` styles + editor theme | ✅ |
| `apps/web` routes — `/archive`, `/archive/seasons/[slug]`, `/archive/events/[slug]`, `/archive/recaps/[slug]`, `/archive/submit` (+`/thanks`), `/archive/pending`, `/admin` (small dashboard) | ✅ |
| `apps/web/lib/archive.ts` — server-side query helpers (`getSeasons`, `getArchiveEventBySlug`, `getRecapBySlug`, `getRecapTargets`, etc.) | ✅ |
| Submission server action `apps/web/app/archive/submit/actions.ts` + client form `SubmitRecapForm.tsx` | ✅ |
| Admin review actions `apps/web/app/archive/pending/actions.ts` (approve / reject / edit) + client card `PendingSubmissionCard.tsx` | ✅ |
| ImageKit integration — `/api/imagekit/auth` mints HMAC-SHA1 signed upload tokens; `_components/PhotoUploader.tsx` POSTs directly to `upload.imagekit.io/api/v1/files/upload`. No SDK. Auth-gated. | ✅ |
| Google Sites scraper at `tools/migrate-google-site/` (Playwright + turndown + turndown-plugin-gfm) — produces a single reviewable JSON file. Workspace package; see its README. | ✅ |

### Decisions locked in Phase 1

- **Photo host: ImageKit.io.** Cloudinary's free tier was already used for another project. Picked ImageKit over Vercel Blob (no transforms) and Supabase Storage (in-stack but felt better to isolate user uploads from the database). Free tier covers 20GB storage + 20GB bandwidth. Three env vars: `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_PRIVATE_KEY`.
- **Content migration: Playwright scrape → JSON for manual review.** Reviewed JSON gets folded into a later `0005_seed_archive_content.sql` migration that UPDATEs the shells from `0004_seed_archive_shells.sql`.
- **`@supabase/ssr` upgraded 0.5.2 → 0.10.3** and `@supabase/supabase-js` pinned to `^2.106.1`. The newer `supabase-js` added generic args to `SupabaseClient<...>` that the old `ssr@0.5.2` mis-passes — net effect was every `from()` returning `never`. The bump is the fix.

### Routes that exist now (Phase 1 additions)
```
/archive
/archive/seasons/[slug]
/archive/events/[slug]
/archive/recaps/[slug]
/archive/submit            (auth required)
/archive/submit/thanks
/archive/pending           (admin only)
/admin                     (admin only — index card list)
/api/imagekit/auth         (auth required)
```

### Gotchas surfaced this phase

- **`Relationships: []` is load-bearing.** `postgrest-js` v2.106's `GenericTable` constraint requires it; missing the property makes the table fail constraint matching and the schema generic resolves to `any/never`. Every table type in `types.ts` now has it.
- **`@supabase/ssr@0.5.2` is incompatible with the v2.106+ `SupabaseClient` generic shape.** Bump ssr to 0.10.x.
- **`@uiw/react-md-editor` blows up under SSR** (reads `navigator` at module load). Use `next/dynamic({ ssr: false })`. That's why `@cfo/ui` now lists `next` as a peer dep — alongside `@cfo/database`'s prior peer.
- **The Google Sites scraper does NOT migrate image binaries.** `images[]` in the output JSON contains the Google-hosted URLs. Re-uploading them to ImageKit is a manual step (do it via the `PhotoUploader` once a recap exists, or via ImageKit's web UI when seeding directly from the JSON).
- **Tailwind v4 `@source` path:** `apps/web/app/globals.css` still has `@source "../../../packages/ui";` — pulling in `@uiw/react-md-editor`'s injected utilities did NOT require another `@source` entry because its CSS is imported directly inside `MarkdownEditor.tsx`. If we later switch to tree-shaking its CSS via Tailwind utilities, that'll change.

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

## Deployment — Vercel

- Hosted at https://carolinafirstandonly.vercel.app (production)
- Project: `paheejs-projects/carolinafirstandonly` (org ID `team_fej3dRHVSy48d1vL7S03zKkK`, project ID `prj_tqn3WbPGORzDJr92srj3UAScsUWe`)
- Linked to the GitHub repo — pushes to `main` auto-deploy via Vercel's Git integration
- Root Directory: `apps/web`. Framework auto-detected as Next.js. No `vercel.json` — Vercel handles the pnpm workspace install at the repo root + builds at `apps/web` automatically.
- Env vars: synced for **Production** and **Development**. **Preview** environment is unset; preview deployments from feature branches won't have Supabase config until you add them per-branch (see Gotcha 6 below).

To redeploy via CLI: `cd <repo root> && vercel deploy --prod`. Don't run from `apps/web` — the CLI will treat it as a non-monorepo project and fail.

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

### 6. Vercel monorepo: `vercel link` from the app dir is a trap
Linking from `apps/web` creates a project whose Root Directory is
unspecified (= repo root in Vercel's eyes), and CLI deploys from there
only upload that subdirectory — so workspace deps don't resolve and the
build tries `npm install`. Fix:

1. `vercel link` from the repo root (so `.vercel/project.json` lives at the root).
2. Set Root Directory to `apps/web` server-side. The CLI doesn't expose a command
   for this — PATCH the project via the API:
   ```bash
   TOKEN=$(jq -r .token < "$HOME/Library/Application Support/com.vercel.cli/auth.json")
   curl -X PATCH "https://api.vercel.com/v9/projects/<projectId>?teamId=<teamId>" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"rootDirectory":"apps/web"}'
   ```
3. **Do not** ship a `vercel.json` with `buildCommand`/`installCommand` overrides
   for a pnpm workspace; let Vercel's framework auto-detection handle it.
4. Deploy from the repo root with `vercel deploy --prod` (not from `apps/web`).

### 7. Vercel CLI's `env add NAME preview` won't default to "all branches"
Despite the CLI help saying "omit branch for all Preview branches," omitting
errors. Workaround: add env vars for `production` and `development` only;
add `preview` per-branch when you start using preview deployments
(`vercel env add NAME preview <branch>`).

---

## What's NOT done (deferred to later phases)

These are intentional — they're either Phase-2+ work or unblocked-but-not-needed:

- Schema for `groups`, `events`, `news_*`, `agent_*`, `calendar_*` —
  **Phase 2+**.
- Generated DB types haven't replaced the hand-written `types.ts` yet
  (no schema churn justifies the swap yet — note the `Relationships: []`
  fix would need to be preserved or the generator would emit them too).
- OAuth providers (Google, Discord) not enabled in Supabase dashboard.
- ImageKit env vars not yet set in Vercel — uploads will 500 until
  `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`,
  and `IMAGEKIT_PRIVATE_KEY` are added (Production + Development).
- Anthropic API not called (Phase 6 agent).
- Google Sites content not yet ingested — run `tools/migrate-google-site`
  when ready and write `0005_seed_archive_content.sql` to UPDATE the shells.

---

## Open items the next phase needs decided

From `CLAUDE.md`'s "Open Items the Builder Should Surface":

1. (Phase 5+) News categories seed list — assumed to be
   `official_news, tactics, painting, lore, community, industry,
   battle_report`. Confirm before seeding.
2. Cloudinary vs Supabase Storage → **decided Phase 1: ImageKit.io.**
3. Google Sites content extraction → **decided Phase 1: Playwright
   scrape into JSON for review.**

---

## How to start a new conversation for Phase 2

In the new session, this is what to load and in what order:

1. `CLAUDE.md` (auto-loaded — it's the source-of-truth spec)
2. `PROGRESS.md` (this file — current state + gotchas)
3. `README.md` (commands + setup)

Then look at:
- `packages/ui/src/index.ts` to see what primitives already exist
- `packages/database/supabase/migrations/` to see what's been applied
- `apps/web/lib/archive.ts` for the per-feature data-access pattern
  (mirror this when building groups/events lib helpers)
- `apps/web/app/archive/submit/` for the server-action + client-form
  pattern (mirror it for `/groups/new` and `/events/new`)

Phase 2 starting point:
- Add migration `0005_groups.sql` (groups, group_members,
  group_pinned_posts, group_role_templates per `CLAUDE.md`)
- Build `/profile/[username]` and `/profile/settings` (settings is a
  partial — Phase 4 fills in calendar connections)
- Build `/groups`, `/groups/new`, `/groups/[slug]` with pinned-posts CRUD
- Add `Avatar`, `Dialog`, `Select`, `Checkbox`, `Radio`, `Tabs` to
  `@cfo/ui` if needed (Modal is required for group settings invitations)
