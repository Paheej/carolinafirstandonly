# Runbook

How to get things done on this project without the owner doing it by hand. Read it with `docs/HANDOFF.md`.

## Working agreement (from the owner)

- **Do the setup work yourself.** Use the CLIs, and use the owner's Chrome (Claude in Chrome) for dashboards, instead of handing over click-by-click instructions. Only fall back to instructions when a step needs the owner personally (paying, a password, 2FA, an Apple/Google identity check).
- **Ask in chat first**, and act once the owner says yes, before you:
  - push a migration to the production database
  - merge a PR (merging deploys to production)
  - delete production data
  - approve an OAuth consent screen
  - submit anything to Google, Apple or Microsoft for review
- **Branches and PRs.** Branch off `main`, open a PR, wait for CI, then merge once approved.
- **Design rules** live in `CLAUDE.md` → Design System. Never use Carolina blue; the palette is Wake Forest black and old gold.

## Accounts and identifiers (none of these are secrets)

| Service | Identifier |
|---|---|
| GitHub | `Paheej/carolinafirstandonly`. The `gh` CLI is logged in. |
| Vercel | Team `paheejs-projects`, project `carolinafirstandonly`. The `vercel` CLI is logged in, and `apps/web` is linked. |
| Supabase | Project ref `ffzmongphrwovudnrhwv` (dashboard name "Carolina_1st"). The `supabase` CLI is logged in. |
| Cloudflare | DNS and email for `carolinafirstandonly.com`. Dashboard: `dash.cloudflare.com/09d17bfef0b0ec52087b37d2c4dd530e/carolinafirstandonly.com` |
| Google Cloud | Project `carolina-first-and-only`: the OAuth client for sign-in, plus the Google Auth Platform branding (verified and published). |
| Google Search Console | Domain property `carolinafirstandonly.com`, verified with a TXT record in Cloudflare. |
| Discord | Developer app for OAuth. Redirect: the Supabase callback below. |
| Apple | Developer enrollment pending. See HANDOFF. |
| ImageKit | Photo storage and resizing (`?tr=w-400`). Keys are in env. |

- **OAuth callback for every provider:** `https://ffzmongphrwovudnrhwv.supabase.co/auth/v1/callback`
- **Supabase Site URL:** `https://carolinafirstandonly.vercel.app`
- **Supabase allowed redirects:** `https://carolinafirstandonly.vercel.app/**`, `http://localhost:3000/**`, `https://new.carolinafirstandonly.com/**`
- **Email:** `privacy@carolinafirstandonly.com` forwards to the owner's Gmail through Cloudflare Email Routing.

## DNS (Cloudflare)

| Record | Value | Note |
|---|---|---|
| `A carolinafirstandonly.com` | `198.49.23.145` | Old Google Sites. Replace at cutover. |
| `CNAME www` | `ghs.googlehosted.com` | Old Google Sites. Replace at cutover. |
| `A new` | `76.76.21.21` | Vercel. **DNS only (grey cloud)**, because Vercel handles TLS. |
| `TXT @` | `google-site-verification=…` | Search Console. Keep. |
| `MX` x3 and the SPF/DKIM TXT records | Cloudflare Email Routing | Keep. |

**Cutover checklist (Phase 7):**

1. In Vercel, add `carolinafirstandonly.com` and `www`.
2. In Cloudflare, point the apex at `76.76.21.21` and `www` at `cname.vercel-dns.com`, both DNS only.
3. If Vercel is slow to issue a certificate, run `vercel certs issue <domain>`.
4. Set `NEXT_PUBLIC_SITE_URL` in Vercel (production) to the new domain, then redeploy.
5. Change the Supabase Site URL and add the new redirect URL.
6. Update the home page and privacy URLs in Google Branding.
7. Members' calendar feed links include the host. Old `vercel.app` links keep working, but the new ones will use the new domain.

## Everyday commands

```bash
pnpm dev                      # web app on localhost:3000, using the hosted Supabase project
pnpm typecheck                # all workspaces
pnpm --filter @cfo/web build  # production build (CI does this too)
pnpm test:sql                 # all migrations + RLS + RPC checks in PGlite (no Docker needed)
pnpm test:sql events          # only the suites whose file name matches
pnpm shots --base https://new.carolinafirstandonly.com / /events   # desktop and phone screenshots, plus an overflow check
```

- `tools/sql-tests/tests/*.mjs` is where database behaviour gets tested. Add a suite for every migration that adds RLS or RPCs. Supabase's `auth` schema is stubbed there, and `as(uid, sql)` runs a query as a given user.
- `tools/screenshots/shoot.mjs` covers signed-out pages only. For signed-in pages, use Claude in Chrome, since the owner's Chrome holds the session.

## Database migrations

Migrations are append-only: `packages/database/supabase/migrations/NNNN_name.sql`. After writing one:

1. Hand-edit `packages/database/src/types.ts` to match. Every table needs `Relationships: []`, or postgrest-js silently degrades its types.
2. Run `pnpm test:sql` and add checks for the new tables and RPCs.
3. **With the owner's OK**, push to production:

```bash
cd carolinafirstandonly
export SUPABASE_DB_PASSWORD=$(grep '^SUPABASE_DB_PASSWORD=' apps/web/.env.local | cut -d= -f2- | tr -d '"')
supabase migration list --workdir packages/database </dev/null   # see what's applied
supabase db push --workdir packages/database --yes </dev/null    # apply
```

- **Always redirect stdin from `/dev/null`.** Otherwise the CLI waits on a password prompt and hangs. `timeout` doesn't exist on macOS.
- **Quick read-only checks** go through the REST API with the anon key. Load the env with `set -a; . apps/web/.env.local; set +a`, then:
  `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/seasons?select=slug" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"`
- **Writes that bypass RLS** use the same pattern with `SUPABASE_SERVICE_ROLE_KEY` in both the `apikey` and `Authorization: Bearer` headers. Ask the owner first.
- **Enabled auth providers:** `curl "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"`.

**Patterns and pitfalls from Phases 2–3:**

- **Membership, RSVPs, invites:** these change only through `security definer` RPCs. The tables have no insert policies for users.
- **RLS on `INSERT ... RETURNING`:** a select policy that looks the row up through a helper function fails here, because the new row isn't visible to the helper yet. Check the row's own columns first (`visibility = 'public' or created_by = auth.uid() or helper(...)`).
- **Errors meant for people:** raise them from Postgres (`raise exception 'Only group admins can invite.'`). Server actions pass `error.message` straight through to `?error=`.

## Deploys

- **Production:** merging to `main` deploys it, after CI (typecheck, SQL tests, both builds) passes. PRs also get Vercel preview deployments.
- **Wait for a deploy:**
  `vercel ls carolinafirstandonly`, then `vercel inspect <deployment-url> --wait --timeout 6m`. The domain switches over a few seconds after "Ready".
- **Environment variables:** `vercel env ls` and `vercel env add NAME production`. The local copy lives in `apps/web/.env.local`, which git ignores.

## Browser work (Claude in Chrome)

- The owner uses **Safari** day to day. **Google Chrome** was installed with Homebrew for this project, along with the **Claude in Chrome** extension.
- In this Chrome, the owner is signed in to Cloudflare, Supabase and Google Cloud. If an extension call fails, ask them to run `/chrome` in Claude Code.
- **Efficiency:** load the tools in one ToolSearch call, and batch actions with `browser_batch`.
- **Dashboard quirks:**
  - **Cloudflare:** dismiss the DNS "welcome" dialog first. In the Add record form, the IPv4 field moves after you type a name, so take a fresh screenshot before clicking.
  - **Google Cloud console:** pages load slowly, so wait about 5 seconds.
- **Reading responses:** the extension blocks returning response bodies that contain URLs or cookies. Return booleans instead, for example `[t.includes('SUMMARY:…'), …].join(',')`.

## Skills and tools used so far

| Tool | Used for |
|---|---|
| `frontend-design:frontend-design` skill | The war-table redesign. Load it before any new page or visual change. |
| `anthropic-skills:chrome-browser` skill and the Claude in Chrome extension | Cloudflare DNS and Email Routing, Supabase auth URLs, Google Branding verification, live end-to-end tests. |
| Artifact tool | Hosted the design prototype: https://claude.ai/artifact/Ern83beTk54LiViYAJJ1CE |
| `gh`, `vercel` (v59; v67 available: `npm i -g vercel@latest`), `supabase` (v2.98; v3.4 available) | PRs, merges, deploys, domains, certificates, migrations |
| Homebrew | Installed Google Chrome |
| Playwright `chromium-headless-shell` | Screenshots. First run on a new machine: `npx playwright install chromium-headless-shell` |
| PGlite (`@electric-sql/pglite`) | Database tests without Docker. No Docker or `psql` on this machine. |

**Fewer permission prompts.** Claude can't loosen its own permissions. The owner can run `/fewer-permission-prompts` in Claude Code, or add allow rules in `.claude/settings.local.json` for the routine commands:

- `pnpm *`
- `gh pr *`
- `vercel ls/inspect/domains/certs/env ls`
- `supabase migration list`

Pushing to the production database and merging stay prompted on purpose.
