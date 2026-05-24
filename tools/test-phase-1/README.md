# @cfo/test-phase-1

End-to-end smoke test for the Phase 1 archive feature. Run it against the
linked Supabase project after applying migrations to verify schema, RLS,
and the three trigger paths (admin notify on submit, publish on approval,
notify submitter on review).

## What it covers

| # | Check |
|---|---|
| 1 | Anon `GET /seasons` returns the seeded shells |
| 2 | Anon `GET /archive_events` returns the seeded shells |
| 3 | Anon cannot `INSERT` into `recap_submissions` (RLS rejects) |
| 4 | Signed-in user can submit a recap (author_id = auth.uid()) |
| 5 | Submission fans out a `recap_submitted` notification to every admin |
| 6 | Approving (status → 'approved') creates a `recaps` row, links it via `published_recap_id`, sets `reviewed_at`, and emits a `recap_approved` notification |
| 7 | The published recap is readable by anon |
| 8 | Rejecting (status → 'rejected') emits a `recap_rejected` notification with the review note |

## Run

```bash
cd tools/test-phase-1
pnpm install
pnpm test
```

`pnpm test` reads env from `apps/web/.env.local` automatically. If you'd
rather pass env explicitly:

```bash
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
  pnpm test
```

## Cleanup

The script creates one auth user (`phase1-test-<run_id>@cfo-test.invalid`)
and a couple of submissions/recaps under it. On exit (even on failure) it
deletes the auth user, which cascades to the profile + submissions + their
notifications. The published recap is explicitly deleted before the user.

If the script crashes mid-run and leaves residue, find it by:

```sql
select id, email from auth.users where email like 'phase1-test-%@cfo-test.invalid';
```

…and delete those users (the cascades will do the rest).

## Do not run against production

This script writes to the linked Supabase project. It does not point at a
test instance unless you swap the env values. As long as the test user's
email pattern is unique it'll clean up properly, but in general: point at
preview/dev environments.
