# Handoff: where things stand

Read this first in a new session, then `docs/RUNBOOK.md` (how to do things) and `PROGRESS.md` (what each phase shipped, plus gotchas). `CLAUDE.md` is the original spec.

_Last updated 2026-11-27._

## State

| Area | State |
|---|---|
| Phases 0–3 | Shipped and live. Archive, war-table redesign, groups and profiles, game days with RSVPs, waitlists and calendar feeds. |
| Phase 4 | Shipped (PR #13). Connect Google Calendar (OAuth), iCloud via share link, daily cron, "Who's free" strip on the event form. Outlook is out of scope. |
| Migrations | 0001–0014 applied on the hosted Supabase project. |
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

## Phase 4: calendar busy-time sync and availability (shipped)

- **Google:** a "Connect Google Calendar" button (OAuth), separate from sign-in, reusing the same OAuth client.
  - Scopes: `calendar.freebusy` and `calendar.calendarlist.readonly`, so the site never sees event details.
  - Sync reads the calendars the member shows in Google Calendar, skipping Google's built-in holiday and birthday calendars, and asks freeBusy for 30 days at a time.
  - Routes: `/api/calendar-connect/google/start` and `/callback`, using PKCE and a state cookie checked against the signed-in user. Code: `apps/web/lib/calendar-oauth.ts`.
  - Callback URLs registered on the OAuth client: `https://carolinafirstandonly.vercel.app`, `https://new.carolinafirstandonly.com` and `http://localhost:3000`, each followed by `/api/calendar-connect/google/callback`. **Add the bare domain's URL at the Phase 7 cutover.**
  - The Google Calendar API is enabled, and both scopes are saved under Data Access.
  - **These are sensitive scopes, unverified on purpose.** The owner accepted the "Google hasn't verified this app" screen (Advanced → continue) and the 100-user cap. Don't submit for verification unless they ask.
- **iCloud:** Apple has no calendar OAuth, so members paste the share link under "Using an iPhone calendar?".
  - The fetch only allows icloud.com hosts, re-checks the host on every redirect, caps responses at 5 MB and times out after 15 s.
  - `apps/web/lib/ics-busy.ts` expands recurrences, skips cancelled and "free" events, reads all-day events as Eastern days, and merges overlaps.
- **Outlook/Microsoft: out of scope** (owner decision, 2026-11-27).
  - The DB constraint still allows `provider = 'outlook'`, because 0014 was already applied, but nothing uses it.
  - The Phase 3 outbound "Add to Outlook" links for game days are a different feature and stay.
- **Migration 0014:**
  - `calendar_connections` stores one `encrypted_secret` (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`), with at most 5 connections per member.
  - `user_busy_blocks` stores times only.
  - `replace_busy_blocks()` can only be called with the service role.
  - `group_availability()` returns counts only, to group members, with days stepped in Eastern time.
  - Tests: `tools/sql-tests/tests/04-calendar.mjs`.
- **Sync:** Vercel Cron runs `/api/cron/calendar-sync` daily at 07:00 UTC (`apps/web/vercel.json`, `CRON_SECRET`), plus "Sync now" and a sync on connect.
- **UI:** Profile settings → "Your busy times, for planning" (`#busy`). The event form shows the "Who's free" strip once the planner has a group.
- **Verified live (2026-11-27):** the owner connected Google on localhost. One busy block was stored (times only), and the token is encrypted.
- **Env:** `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in every Vercel environment and in `.env.local`. **If the key is lost, every connection has to be made again.**
- **Groups:** "Curse of Strahd" (`/groups/curse-of-strahd`): invite only, listed in the directory, D&D, owned by the owner. "Who's free" was verified live with it (Jan 19 showed 0 of 1, matching the owner's busy block).

## Later phases

5 News and voting, 6 the AI news agent, 7 polish and the DNS cutover. See `CLAUDE.md` → Build Order.
