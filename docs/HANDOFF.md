# Handoff: where things stand

Read this first in a new session, then `docs/RUNBOOK.md` (how to do things) and `PROGRESS.md` (what each phase shipped, plus gotchas). `CLAUDE.md` is the original spec.

_Last updated 2026-11-27._

## State

| Area | State |
|---|---|
| Phases 0–3 | Shipped and live. Archive, war-table redesign, groups and profiles, game days with RSVPs, waitlists and calendar feeds. |
| Phase 4 | Busy-time sync via calendar links (iCloud, Google, Outlook), daily cron, "who's free" strip on the event form. Branch `phase-4-calendar-sync`; see below for status. |
| Migrations | 0001–0013 applied on the hosted Supabase project. 0014 (calendar sync) is in the Phase 4 PR. |
| Production | `main` auto-deploys to https://carolinafirstandonly.vercel.app and https://new.carolinafirstandonly.com |
| Bare domain | `carolinafirstandonly.com` still serves the old Google Sites page. Cutover is a Phase 7 task (see the RUNBOOK). |
| Sign-in | Google works, and its branding is verified and published. Discord has an app and is configured, but a sign-in hasn't been confirmed end to end. Apple is waiting on the owner's Apple Developer approval. Email/password works. |
| Tests | `pnpm test:sql` (78 database checks, also run in CI), `pnpm typecheck`, `pnpm --filter @cfo/web build`. |

## Waiting on the owner

1. **Apple Developer approval.** Then they send the Team ID and Key ID. Run `scripts/apple-client-secret.mjs` (instructions are in the file), paste the result into Supabase → Authentication → Providers → Apple, enable the Apple button in `apps/web/app/auth/_components/AuthForm.tsx`, and set a reminder: the secret expires every 6 months.
2. **Curse of Strahd details** (start date, DM, write-up). The season row `curse-of-strahd` has only a one-line description.

## Not yet verified

- The waitlist and notifications with two real accounts. The logic passes `pnpm test:sql`, but nobody has tried it live with a second person. Suggested test: sign in with Discord in a private window as a second user.
- A Discord sign-in, end to end.

## Phase 4: calendar busy-time sync and availability

**Built (PR `phase-4-calendar-sync`):**

- **Connections use calendar links, not OAuth.** iCloud ("Public Calendar" link), Google ("Secret address in iCal format") and Outlook ("Publish a calendar", busy-only) all give a private ICS link. That covers all three without Google's sensitive-scope review or an Azure app. `provider` also allows `google`/`outlook` for OAuth later.
- **Migration `0014_calendar_sync.sql`.** This differs from the spec's table sketch:
  - One `encrypted_secret` column holds the link or a future refresh token, encrypted with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`).
  - Each member can connect up to 5 calendars.
  - `user_busy_blocks.connection_id` cascades on delete.
  - `replace_busy_blocks()` can only be called with the service role.
  - `group_availability(group, start, end, days)` returns counts only, checks group membership, and steps days in Eastern time. Tests are in `tools/sql-tests/tests/04-calendar.mjs`.
- **Code:**
  - `apps/web/lib/calendar-sync.ts`: encryption, the host allowlist (icloud.com, calendar.google.com, outlook.*), a manual-redirect fetch with a 5 MB cap and a 15 s timeout, and `syncConnection`/`syncAll`.
  - `apps/web/lib/ics-busy.ts`: parsing with `node-ical`. It expands recurrences, skips cancelled and "free" (TRANSPARENT) events, reads all-day events as Eastern days, and merges overlaps. Only start and end times are kept.
- **Sync:** `/api/cron/calendar-sync` runs daily at 07:00 UTC (`apps/web/vercel.json`) and needs `CRON_SECRET`. Members can also press "Sync now", and a calendar syncs as soon as it's connected.
- **UI:**
  - Profile settings → "Your busy times, for planning" (`#busy`).
  - The event form shows the "Who's free" strip when the planner has groups: the chosen time on that day and the next 13 days. Tapping a day picks it. The data comes from `/api/availability`.
- **Privacy page** has been updated to match.
- **Env:** `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET` are set in Vercel (all environments) and in `apps/web/.env.local`. **If the key is lost, every stored link has to be pasted again.** Don't rotate it without re-encrypting the stored links.

**Still to do:**

- Live test with a real iCloud/Google link on the preview, then merge.
- Optional later: Google/Outlook OAuth (see the original plan in git history). Only worth it if members find copying links too fiddly.

## Later phases

5 News and voting, 6 the AI news agent, 7 polish and the DNS cutover. See `CLAUDE.md` → Build Order.
