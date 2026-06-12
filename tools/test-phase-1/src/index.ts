/**
 * Phase 1 smoke test.
 *
 * Exercises the archive flow end-to-end against a live Supabase project:
 *   1. Anon can read seasons + archive_events (public RLS)
 *   2. Anon CANNOT insert into recap_submissions (RLS rejects)
 *   3. A signed-in user can submit a recap (RLS allows when author_id = auth.uid())
 *   4. Inserting a submission fans out a notification to every admin
 *   5. Approving a submission (status -> 'approved') publishes a recap row
 *      and notifies the submitter (publish_recap_on_approval trigger)
 *   6. The published recap is visible to anon (public read RLS)
 *   7. Rejecting a separate submission produces a 'recap_rejected' notification
 *
 * Cleans up after itself by deleting the test auth user (which cascades to
 * the profile / submissions / recaps).
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run from repo root:
 *   pnpm --filter @cfo/test-phase-1 test
 * or with explicit env:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     pnpm --filter @cfo/test-phase-1 test
 *
 * Note: this script writes to the linked Supabase project. It scopes all
 * test fixtures under a random suffix and tears them down on exit, but you
 * still should not point it at production unless you trust the cleanup.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Database } from '@cfo/database/types';

// ----------------------------------------------------------------------------
// env loading — read repo-root .env files in addition to process.env so the
// script can be run from the workspace root without an explicit shell export.
// ----------------------------------------------------------------------------

function loadDotenv(path: string) {
    if (!existsSync(path)) return;
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadDotenv(resolve(process.cwd(), '../../apps/web/.env.local'));
loadDotenv(resolve(process.cwd(), '../../.env.local'));
loadDotenv(resolve(process.cwd(), '../../.env'));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
    process.stderr.write(
        'missing env. Need NEXT_PUBLIC_SUPABASE_URL, ' +
            'NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.\n',
    );
    process.exit(2);
}

// ----------------------------------------------------------------------------
// tiny test harness — no framework, just colored PASS/FAIL with timing.
// ----------------------------------------------------------------------------

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface Result {
    name: string;
    ok: boolean;
    detail?: string;
    ms: number;
}
const results: Result[] = [];

async function check(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
        await fn();
        results.push({ name, ok: true, ms: Date.now() - start });
        process.stdout.write(
            `${GREEN}PASS${RESET} ${name} ${DIM}(${Date.now() - start}ms)${RESET}\n`,
        );
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        results.push({ name, ok: false, detail, ms: Date.now() - start });
        process.stdout.write(
            `${RED}FAIL${RESET} ${name} ${DIM}(${Date.now() - start}ms)${RESET}\n      ${detail}\n`,
        );
    }
}

function assertEq<T>(actual: T, expected: T, label: string) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertTrue(cond: boolean, label: string) {
    if (!cond) throw new Error(label);
}

// ----------------------------------------------------------------------------
// clients
// ----------------------------------------------------------------------------

const anon: SupabaseClient<Database> = createClient<Database>(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
});
const admin: SupabaseClient<Database> = createClient<Database>(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
});

// ----------------------------------------------------------------------------
// fixtures
// ----------------------------------------------------------------------------

const RUN_ID = Math.random().toString(36).slice(2, 8);
const TEST_EMAIL = `phase1-test-${RUN_ID}@cfo-test.invalid`;
const TEST_PASSWORD = `phase1-${RUN_ID}-pw!`;

let testUserId: string | null = null;
let testUserClient: SupabaseClient<Database> | null = null;
let seasonId: string | null = null;
let archiveEventId: string | null = null;
let approvedSubmissionId: string | null = null;
let approvedRecapSlug: string | null = null;
let rejectedSubmissionId: string | null = null;

async function setup() {
    // Pick any existing season + event shell to attach test submissions to.
    const { data: seasons, error: sErr } = await admin
        .from('seasons')
        .select('id')
        .order('display_order')
        .limit(1);
    if (sErr) throw sErr;
    if (!seasons || seasons.length === 0 || !seasons[0]) {
        throw new Error(
            'No seasons in DB. Did 0004_seed_archive_shells.sql get applied?',
        );
    }
    seasonId = seasons[0].id;

    const { data: events, error: eErr } = await admin
        .from('archive_events')
        .select('id')
        .order('display_order')
        .limit(1);
    if (eErr) throw eErr;
    if (!events || events.length === 0 || !events[0]) {
        throw new Error('No archive_events in DB.');
    }
    archiveEventId = events[0].id;

    // Create test user via admin API. email_confirm bypasses confirmation flow.
    const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
    });
    if (createErr) throw createErr;
    if (!createRes.user) throw new Error('createUser returned no user');
    testUserId = createRes.user.id;

    // Get a user-context client by signing in. Wait for the on_auth_user_created
    // trigger to materialise the profile row.
    testUserClient = createClient<Database>(URL!, ANON!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await testUserClient.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    if (signInErr) throw signInErr;

    // Brief wait for trigger to populate profiles row.
    for (let i = 0; i < 10; i++) {
        const { data: prof } = await admin
            .from('profiles')
            .select('id')
            .eq('id', testUserId)
            .maybeSingle();
        if (prof) break;
        await new Promise((r) => setTimeout(r, 100));
    }
}

async function teardown() {
    if (testUserId) {
        // Delete the auth user — ON DELETE CASCADE removes the profile,
        // submissions, and notifications. Recaps reference profiles with
        // ON DELETE SET NULL, so they hang around — clean those up explicitly.
        if (approvedRecapSlug) {
            await admin.from('recaps').delete().eq('slug', approvedRecapSlug);
        }
        await admin.auth.admin.deleteUser(testUserId);
    }
}

// ----------------------------------------------------------------------------
// the checks
// ----------------------------------------------------------------------------

async function run() {
    await check('setup — pick seed shells + create test user + sign in', setup);

    await check('anon: GET /seasons returns the seeded shells', async () => {
        const { data, error } = await anon.from('seasons').select('id, slug, name');
        if (error) throw error;
        assertTrue((data?.length ?? 0) >= 3, `expected >=3 seasons, got ${data?.length}`);
    });

    await check('anon: GET /archive_events returns the seeded shells', async () => {
        const { data, error } = await anon
            .from('archive_events')
            .select('id, slug, name');
        if (error) throw error;
        assertTrue((data?.length ?? 0) >= 3, `expected >=3 events, got ${data?.length}`);
    });

    await check('RLS: anon cannot insert into recap_submissions', async () => {
        const { error } = await anon.from('recap_submissions').insert({
            author_id: testUserId!,
            season_id: seasonId!,
            title: 'should fail',
            body_md: 'should fail because anon has no row in profiles',
        });
        assertTrue(error !== null, 'expected RLS error, got success');
    });

    await check('user: can submit a recap (RLS allows author_id = auth.uid())', async () => {
        const { data, error } = await testUserClient!
            .from('recap_submissions')
            .insert({
                author_id: testUserId!,
                season_id: seasonId!,
                title: `Phase 1 smoke test recap ${RUN_ID}`,
                body_md:
                    'This is an automated smoke-test recap. It should be cleaned up before the script exits.\n\n## Round 1\n\nA test was had by all.',
            })
            .select('id')
            .single();
        if (error) throw error;
        if (!data) throw new Error('insert returned no id');
        approvedSubmissionId = data.id;
    });

    await check('trigger: admin notification fan-out on submission', async () => {
        // Count notifications of kind=recap_submitted created since submission.
        // Use the link_url to find ones pointing at the pending queue.
        const { data: adminProfiles, error: adminErr } = await admin
            .from('profiles')
            .select('id')
            .eq('is_admin', true);
        if (adminErr) throw adminErr;
        assertTrue(
            (adminProfiles?.length ?? 0) >= 1,
            'no admin profile present — set NEXT_PUBLIC_ADMIN_EMAILS and sign in once',
        );

        const adminId = adminProfiles![0]!.id;
        const { data: notifs, error: notifErr } = await admin
            .from('notifications')
            .select('id, body, kind')
            .eq('user_id', adminId)
            .eq('kind', 'recap_submitted')
            .order('created_at', { ascending: false })
            .limit(5);
        if (notifErr) throw notifErr;
        const matching = (notifs ?? []).filter((n) =>
            n.body?.includes(`Phase 1 smoke test recap ${RUN_ID}`),
        );
        assertTrue(matching.length >= 1, 'no matching admin notification found');
    });

    await check('trigger: approving creates a recap + notifies submitter', async () => {
        const { error: updErr } = await admin
            .from('recap_submissions')
            .update({ status: 'approved' })
            .eq('id', approvedSubmissionId!);
        if (updErr) throw updErr;

        // Fetch the submission to discover the recap slug it produced.
        const { data: subAfter, error: subErr } = await admin
            .from('recap_submissions')
            .select('status, published_recap_id, reviewed_at')
            .eq('id', approvedSubmissionId!)
            .single();
        if (subErr) throw subErr;
        assertEq(subAfter.status, 'approved', 'submission not marked approved');
        assertTrue(
            subAfter.published_recap_id !== null,
            'published_recap_id not populated by trigger',
        );
        assertTrue(subAfter.reviewed_at !== null, 'reviewed_at not populated');

        const { data: recap, error: recapErr } = await admin
            .from('recaps')
            .select('slug, title, published_at')
            .eq('id', subAfter.published_recap_id!)
            .single();
        if (recapErr) throw recapErr;
        assertTrue(recap.title.includes(`Phase 1 smoke test recap ${RUN_ID}`), 'wrong recap title');
        assertTrue(recap.published_at !== null, 'recap not published');
        approvedRecapSlug = recap.slug;

        const { data: subNotifs, error: nErr } = await admin
            .from('notifications')
            .select('kind, body')
            .eq('user_id', testUserId!)
            .eq('kind', 'recap_approved');
        if (nErr) throw nErr;
        assertTrue((subNotifs?.length ?? 0) >= 1, 'submitter approval notification missing');
    });

    await check('anon: published recap is publicly readable', async () => {
        const { data, error } = await anon
            .from('recaps')
            .select('slug, title')
            .eq('slug', approvedRecapSlug!)
            .maybeSingle();
        if (error) throw error;
        assertTrue(data !== null, 'anon could not read the published recap');
    });

    await check('trigger: rejecting produces submitter notification', async () => {
        const { data: insertRes, error: insErr } = await testUserClient!
            .from('recap_submissions')
            .insert({
                author_id: testUserId!,
                archive_event_id: archiveEventId!,
                title: `Phase 1 smoke test reject ${RUN_ID}`,
                body_md: 'This one will get rejected by the test harness.',
            })
            .select('id')
            .single();
        if (insErr) throw insErr;
        rejectedSubmissionId = insertRes!.id;

        const { error: rejErr } = await admin
            .from('recap_submissions')
            .update({
                status: 'rejected',
                review_notes: 'Smoke-test rejection.',
            })
            .eq('id', rejectedSubmissionId!);
        if (rejErr) throw rejErr;

        const { data: notifs, error: nErr } = await admin
            .from('notifications')
            .select('kind, body')
            .eq('user_id', testUserId!)
            .eq('kind', 'recap_rejected');
        if (nErr) throw nErr;
        assertTrue((notifs?.length ?? 0) >= 1, 'submitter rejection notification missing');
        const matching = (notifs ?? []).find((n) => n.body?.includes('Smoke-test rejection'));
        assertTrue(!!matching, 'rejection note not included in notification body');
    });
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------

async function main() {
    process.stdout.write(
        `Phase 1 smoke test (run id: ${RUN_ID})\nTarget: ${URL}\n\n`,
    );
    try {
        await run();
    } finally {
        try {
            await teardown();
        } catch (err) {
            process.stderr.write(
                `\nteardown error (manual cleanup may be needed): ${(err as Error).message}\n`,
            );
        }
    }

    const passed = results.filter((r) => r.ok).length;
    const failed = results.length - passed;
    process.stdout.write(
        `\n${passed} passed, ${failed} failed (${results.length} total)\n`,
    );
    process.exit(failed === 0 ? 0 : 1);
}

main();
