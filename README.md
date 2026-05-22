# Carolina First and Only

Community platform for a Charlotte-area tabletop gaming group.

- **`CLAUDE.md`** — source-of-truth build spec (read first)
- **`PROGRESS.md`** — what's shipped, where things live, gotchas to avoid (read before starting a new phase)

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Supabase (Postgres + Auth + Storage) · Cloudinary · Vercel · Anthropic Claude API.

## Repo layout

```
apps/
  web/        Next.js site
  agent/      AI content agent (cron + manual trigger)
packages/
  database/   Supabase migrations + generated types
  ui/         Design system
  shared/     Shared types, constants, utilities
```

## Local setup

Prereqs: Node 20+, [pnpm](https://pnpm.io) (via `corepack enable`), [Supabase CLI](https://supabase.com/docs/guides/cli). A container runtime (Docker / Colima / OrbStack) is only needed if you want a *local* Supabase — we're currently using the hosted project (see below).

```bash
# 1. Install deps
corepack enable
pnpm install

# 2. Point the web app at a Supabase project
#    .env.local goes inside the app — Next.js doesn't pick it up from the root.
cp .env.example apps/web/.env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_ADMIN_EMAILS.

# 3. Apply migrations to the project
#    Hosted: link once, then push.
supabase link --project-ref <YOUR_REF> --workdir packages/database
SUPABASE_DB_PASSWORD=<pwd> supabase db push --workdir packages/database

#    Local (only if you have Docker): pnpm db:start && pnpm db:reset

# 4. Generate the TypeScript schema
supabase gen types typescript --project-id <YOUR_REF> --schema public \
  > packages/database/src/types.generated.ts

# 5. Run the web app
pnpm dev
```

Open <http://localhost:3000>. Sign up with the admin email and the home page should show an admin chip in the nav.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the web app in dev mode |
| `pnpm build` | Build all apps |
| `pnpm typecheck` | Run `tsc --noEmit` across the workspace |
| `pnpm db:start` | Start local Supabase (Docker) |
| `pnpm db:stop` | Stop local Supabase |
| `pnpm db:reset` | Wipe + reapply all migrations |
| `pnpm db:types` | Regenerate `packages/database/src/types.generated.ts` |
| `pnpm db:diff` | Diff local DB against migrations |

## Phase status

- [x] **Phase 0 — Foundation:** monorepo, design tokens + primitives, Next.js shell, Supabase init, auth callback, profile auto-create
- [ ] Phase 1 — Archive
- [ ] Phase 2 — Groups + Profiles
- [ ] Phase 3 — Events + RSVPs
- [ ] Phase 4 — Calendar + Availability
- [ ] Phase 5 — News + Voting
- [ ] Phase 6 — AI Agent
- [ ] Phase 7 — Polish + Launch
