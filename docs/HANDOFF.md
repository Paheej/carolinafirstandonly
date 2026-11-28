# Handoff: where things stand

Read this first in a new session, then `docs/RUNBOOK.md` (how to do things) and `PROGRESS.md` (what each phase shipped, plus gotchas). `CLAUDE.md` is the original spec.

_Last updated 2026-11-28 (Phase 5)._

## Start here (next session)

**Next step: Phase 6, the AI news agent** (`CLAUDE.md` → Build Order and Feature Specs → AI Agent).

1. Write migration `0024` for `agent_sources` and `agent_drafts`, and seed the sources. `news_categories` already exists (0022) with the six categories the agent's prompt should use.
2. The agent's prompt must not offer `battle_report` (removed by the owner).
3. Publishing a draft creates a `news_posts` row with `author_id = null` and `source_url` set. The feed already shows "via <host>" for that.
4. `ANTHROPIC_API_KEY` and `YOUTUBE_API_KEY` aren't set yet. Ask the owner.
5. Load the `frontend-design:frontend-design` skill before building `/news/admin/drafts`.

The owner sends "nits" in batches between phases. Do each batch on one branch and one PR, check it in Chrome, then ask before merging. They usually say yes.

## State

| Area | State |
|---|---|
| Phases 0–5 | Shipped and live. Phase 5: news feed (Hot/Top/New), post pages, the admin composer and anonymous voting. Archive, war-table redesign, groups and profiles, game days (RSVPs, waitlists, calendar feeds), and calendar busy-time sync with "Who's free". |
| Polish since Phase 4 (PRs #14–#17) | Listed in "Recent changes" below. |
| Migrations | **0001–0023 applied** on the hosted Supabase project. The next one is `0024`. (0023 re-dated the imported Season II and Showdown recaps by their season or event, so the home page's Recaps shows the newest first.) |
| Production | `main` auto-deploys to https://carolinafirstandonly.vercel.app and https://new.carolinafirstandonly.com |
| Bare domain | `carolinafirstandonly.com` still serves the old Google Sites page. Cutover is a Phase 7 task (see the RUNBOOK). |
| Sign-in | Google works, and its branding is verified and published. Discord has an app and is configured, but a sign-in hasn't been confirmed end to end. Apple is waiting on the owner's Apple Developer approval. Email/password works. |
| Tests | `pnpm test:sql` (119 database checks, also run in CI), `pnpm typecheck`, `pnpm --filter @cfo/web build`, `pnpm shots --base <url> <paths>`. |
| Old Google Site | **Fully migrated.** Seasons I–III (with Season III's 9 reference pages), the Old World Campaign (6 pages and 9 recaps), and the events. Only the index pages (Home, 40k Seasons, Events) were skipped. |

## Recent changes (2026-11-27 to 28, PRs #14–#17)

- **Home hero (`apps/web/app/_components/CampaignHero.tsx`):**
  - The next game day and each running campaign take turns as slides, game day first, auto-advancing every 9 s.
  - Each slide gets its system's board: `<DungeonMap />` for D&D, `<WarTable />` otherwise.
  - Group-only game days appear only for members.
- **Archive index:** Campaigns are split into "Running now" and "Completed" (newest first). Special events are newest first. Reference pages live on their season's page.
- **Archive detail pages:** the photo page head (`PageHead image=… tone="light"`). The gold badge is solid on dark bands, and pages with no photo get a light band.
- **Wording:** the site says "recap" everywhere, never "battle report". Seasons are named "40k - Season I/II/III".
- **Games:**
  - 40K keeps its numbered editions (1st–11th). The owner reversed a brief "3rd/Current" consolidation.
  - Net Epic Armageddon and Battlefleet Gothic are separate systems.
  - Seasons and events can list **several games** (`games` jsonb, 0021). Burning Star is 40K 11th and 3rd, Epic and BFG. Drafted! is Warhammer Fantasy 5th.
  - Admin forms have "Add another game".
- **Groups** get a crest (`<GroupCrest />` via `lib/crest.ts`) everywhere a group is named.
- **Game days:** `/events` has List and Calendar views. The month grid shows a "who's free" bar per day for a chosen group and time slot.
- **Usernames** keep the case they're typed in ("Paheej"). Lookups ignore case.
- **Content import tools:** `tools/migrate-google-site/` (`takeout.ts`, `build-old-world.mjs`, `build-season-3.mjs`). The Takeout export is at `~/Downloads/Takeout/Drive/sites/Copy of www.carolinafirstandonly.com/DRAFT`.

## Owner decisions to remember

- Never use Carolina blue. The palette is Wake Forest black and old gold.
- Outlook calendar sync is out of scope. The Google calendar scopes stay **unverified on purpose**, since the owner accepted the warning screen and the 100-user cap.
- The owner doesn't want "paste a link" as a main path: iCloud is the only link-based connection.
- Keep numbered 40K editions.
- Old World Campaign: the status "completed" and its placement were assumptions, and the winner is unknown. Ask if the owner wants it changed.

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

## Phase 5: news and voting (shipped)

See `PROGRESS.md` → Phase 5. In short:
- Categories: Official News, Tactics, Painting, Lore, Community, Industry.
- Anyone can vote. Votes are tied to a FingerprintJS visitor ID kept in a cookie and HMAC'd with `FINGERPRINT_HMAC_SECRET`, and each IP gets 30 votes per 10 minutes.
- Admins write at `/news/admin/new`.
- The home page shows the 3 hottest posts above Recaps.

## Later phases

6 the AI news agent (next), 7 polish and the DNS cutover. See `CLAUDE.md` → Build Order.
