# Handoff: where things stand

Read this first in a new session, then `docs/RUNBOOK.md` (how to do things) and `PROGRESS.md` (what each phase shipped, plus gotchas). `CLAUDE.md` is the original spec.

_Last updated 2026-11-27._

## State

| Area | State |
|---|---|
| Phases 0–3 | Shipped and live. Archive, war-table redesign, groups and profiles, game days with RSVPs, waitlists and calendar feeds. |
| Migrations | 0001–0013 applied on the hosted Supabase project. |
| Production | `main` auto-deploys to https://carolinafirstandonly.vercel.app and https://new.carolinafirstandonly.com |
| Bare domain | `carolinafirstandonly.com` still serves the old Google Sites page. Cutover is a Phase 7 task (see the RUNBOOK). |
| Sign-in | Google works, and its branding is verified and published. Discord has an app and is configured, but a sign-in hasn't been confirmed end to end. Apple is waiting on the owner's Apple Developer approval. Email/password works. |
| Tests | `pnpm test:sql` (56 database checks, also run in CI), `pnpm typecheck`, `pnpm --filter @cfo/web build`. |

## Waiting on the owner

1. **Apple Developer approval.** Then they send the Team ID and Key ID. Run `scripts/apple-client-secret.mjs` (instructions are in the file), paste the result into Supabase → Authentication → Providers → Apple, enable the Apple button in `apps/web/app/auth/_components/AuthForm.tsx`, and set a reminder: the secret expires every 6 months.
2. **Curse of Strahd details** (start date, DM, write-up). The season row `curse-of-strahd` has only a one-line description.

## Not yet verified

- The waitlist and notifications with two real accounts. The logic passes `pnpm test:sql`, but nobody has tried it live with a second person. Suggested test: sign in with Discord in a private window as a second user.
- A Discord sign-in, end to end.

## Next: Phase 4 (calendar busy-time sync and availability)

The goal is "5 of 8 free" when planning a game day. The plan:

1. Migration `0014_calendar_sync.sql`:
   - `calendar_connections`: one row per user per provider. Store refresh tokens encrypted with AES-GCM using `TOKEN_ENCRYPTION_KEY`, and never store them in plain text.
   - `user_busy_blocks`: busy windows only, never titles.
   - an `availability(group_id, start, end)` RPC that returns counts, not people.
2. **Apple and iCloud first** (no OAuth needed). The member pastes their iCloud "public calendar" ICS URL. A daily Vercel Cron fetches it, parses it with `node-ical`, and writes the busy blocks. Hobby plan crons run at most once a day.
3. **Google Calendar.**
   - Ask for the `calendar.freebusy` (or `calendar.readonly`) scope in a separate "Connect Google Calendar" flow, not at sign-in.
   - That is a **sensitive scope**, so Google will require a verification review (a demo video plus a scope justification) before people outside the test-user list can connect.
   - Plan for it: keep the app in testing for calendar, or add the club's members as test users while the review runs.
4. **Outlook.** This needs an Azure app registration (Microsoft account), with the Graph scope `Calendars.Read`.
5. **UI.**
   - Profile settings: a "Connected calendars" section.
   - Event form: once a group and time are picked, show an availability strip (`/api/availability`).
6. **Privacy page.** It already describes busy-times-only calendar sync. Keep the code matching it.

## Later phases

5 News and voting, 6 the AI news agent, 7 polish and the DNS cutover. See `CLAUDE.md` → Build Order.
