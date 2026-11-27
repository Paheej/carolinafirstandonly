/**
 * Runs every migration in packages/database/supabase/migrations against an
 * in-memory Postgres (PGlite, no Docker), with Supabase's auth schema
 * stubbed, then runs each tests/*.mjs file against it.
 *
 *   pnpm --filter @cfo/sql-tests test            # all suites
 *   pnpm --filter @cfo/sql-tests test events     # suites whose name matches
 *
 * Each suite gets a fresh database. Helpers passed to a suite:
 *   as(uid, sql, params)  run as that user (role authenticated, auth.uid() = uid),
 *                         or as anon when uid is null. Returns rows or { error }.
 *   q(sql, params)        run as superuser (bypasses RLS), returns rows.
 *   check(label, cond)    assert; failures are counted and exit non-zero.
 *   U                     four seeded users: owner, bob, cat, dan.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, '../../packages/database/supabase/migrations');
const filter = process.argv[2];

const U = {
    owner: '00000000-0000-0000-0000-00000000000a',
    bob: '00000000-0000-0000-0000-00000000000b',
    cat: '00000000-0000-0000-0000-00000000000c',
    dan: '00000000-0000-0000-0000-00000000000d',
};

async function freshDb() {
    const db = new PGlite();
    await db.exec(`
        create role anon; create role authenticated;
        create schema auth;
        create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
            select nullif(current_setting('test.uid', true), '')::uuid $$;
        grant usage on schema auth to anon, authenticated;
        grant execute on function auth.uid() to anon, authenticated;
    `);
    for (const f of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
        // PGlite lacks pgcrypto/citext; gen_random_uuid() is core Postgres.
        const sql = readFileSync(join(migrations, f), 'utf8').replace(/create extension[^;]+;/gi, '');
        try {
            await db.exec(sql);
        } catch (e) {
            throw new Error(`${f}: ${e.message}`);
        }
    }
    // Supabase grants table access to these roles; RLS does the rest.
    await db.exec(`grant usage on schema public to anon, authenticated;
                   grant all on all tables in schema public to anon, authenticated;`);
    for (const [name, id] of Object.entries(U)) {
        await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${name}@example.com`]);
    }
    return db;
}

let failures = 0;
let passes = 0;
const suites = readdirSync(join(here, 'tests')).filter((f) => f.endsWith('.mjs') && (!filter || f.includes(filter))).sort();
for (const file of suites) {
    console.log(`\n# ${file}`);
    const db = await freshDb();
    const as = async (uid, sql, params = []) => {
        await db.exec(`reset role; select set_config('test.uid', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
        try {
            return (await db.query(sql, params)).rows;
        } catch (e) {
            return { error: e.message };
        } finally {
            await db.exec('reset role');
        }
    };
    const q = async (sql, params = []) => (await db.query(sql, params)).rows;
    const check = (label, cond, detail) => {
        if (cond) passes++;
        else failures++;
        console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${!cond && detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''}`);
    };
    const { default: suite } = await import(join(here, 'tests', file));
    await suite({ db, as, q, check, U });
    await db.close();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
