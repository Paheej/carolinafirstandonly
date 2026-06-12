/**
 * One-off scraper for the existing carolinafirstandonly.com (Google Sites).
 *
 * Crawls a starting URL on the same site origin, renders each page with
 * Playwright (Google Sites uses JS for nav and lazy-loaded content),
 * strips chrome, converts main content to markdown via turndown, and
 * writes a single JSON file you can review / edit before seeding the DB.
 *
 * Usage:
 *   cd tools/migrate-google-site
 *   pnpm install
 *   pnpm exec playwright install chromium
 *   pnpm scrape -- --start https://sites.google.com/view/carolinafirstandonly \
 *                  --out ./out/scrape.json
 *
 * Then review the JSON, hand-edit titles/slugs/order, and feed into a
 * follow-up Supabase migration (e.g. 0005_seed_archive_content.sql) that
 * UPDATEs the shells inserted by 0004.
 */

import { chromium, type Page } from 'playwright';
import TurndownService from 'turndown';
// `turndown-plugin-gfm` lacks types — treat as untyped.
// @ts-expect-error: no types
import { gfm } from 'turndown-plugin-gfm';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

interface ScrapedPage {
    url: string;
    title: string;
    heading: string | null;
    markdown: string;
    images: Array<{ src: string; alt: string }>;
    crawledAt: string;
}

interface ScrapeResult {
    startUrl: string;
    origin: string;
    totalPages: number;
    pages: ScrapedPage[];
}

function parseCliArgs() {
    const { values } = parseArgs({
        options: {
            start: { type: 'string' },
            out: { type: 'string', default: './out/scrape.json' },
            'max-pages': { type: 'string', default: '60' },
            delay: { type: 'string', default: '500' },
        },
        allowPositionals: false,
    });
    if (!values.start) {
        throw new Error('--start <url> is required');
    }
    return {
        start: values.start,
        out: values.out!,
        maxPages: Number(values['max-pages']),
        delayMs: Number(values.delay),
    };
}

function makeTurndown(): TurndownService {
    const td = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '_',
    });
    td.use(gfm);
    // Drop Google Sites' clickwrap junk.
    td.remove(['script', 'style', 'noscript', 'iframe']);
    return td;
}

async function extractPage(page: Page, td: TurndownService): Promise<ScrapedPage> {
    // Give Google Sites' SPA a beat to populate.
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

    const url = page.url();
    const title = await page.title();

    // Google Sites' main content lives under role=main; fall back to <main>.
    const mainHtml = await page.evaluate(() => {
        const root =
            document.querySelector('[role="main"]') ??
            document.querySelector('main') ??
            document.body;

        // Clone, scrub nav/header/footer/buttons before serializing.
        const clone = root.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(
            'nav, header, footer, button, [role="navigation"], [role="banner"], [role="contentinfo"]',
        ).forEach((el) => el.remove());
        // Strip empty container divs Google Sites loves.
        clone.querySelectorAll('div').forEach((el) => {
            if (!el.textContent?.trim() && el.querySelectorAll('img').length === 0) {
                el.remove();
            }
        });
        return clone.innerHTML;
    });

    const heading = await page
        .locator('h1, h2')
        .first()
        .textContent()
        .then((t) => t?.trim() ?? null)
        .catch(() => null);

    const images = await page.$$eval('img', (els) =>
        els
            .map((el) => ({ src: el.currentSrc || el.src, alt: el.alt }))
            .filter((img) => img.src && !img.src.startsWith('data:')),
    );

    return {
        url,
        title,
        heading,
        markdown: td.turndown(mainHtml).trim(),
        images,
        crawledAt: new Date().toISOString(),
    };
}

async function discoverLinks(page: Page, origin: string): Promise<string[]> {
    return page.$$eval(
        'a[href]',
        (anchors, originValue) => {
            const seen = new Set<string>();
            for (const a of anchors as HTMLAnchorElement[]) {
                try {
                    const u = new URL(a.href, originValue);
                    // Stay on this Google Site only.
                    if (u.origin !== new URL(originValue).origin) continue;
                    u.hash = '';
                    seen.add(u.toString());
                } catch {
                    /* ignore malformed href */
                }
            }
            return Array.from(seen);
        },
        origin,
    );
}

async function main() {
    const { start, out, maxPages, delayMs } = parseCliArgs();
    const startUrl = new URL(start);
    const origin = startUrl.origin;

    const td = makeTurndown();
    const browser = await chromium.launch();
    const context = await browser.newContext({
        userAgent:
            'Mozilla/5.0 (compatible; CarolinaFirstAndOnly-Migrator/1.0; +https://carolinafirstandonly.com)',
    });
    const page = await context.newPage();

    const visited = new Set<string>();
    const queue: string[] = [start];
    const pages: ScrapedPage[] = [];

    try {
        while (queue.length > 0 && pages.length < maxPages) {
            const next = queue.shift()!;
            if (visited.has(next)) continue;
            visited.add(next);

            process.stderr.write(`[${pages.length + 1}] ${next}\n`);
            try {
                await page.goto(next, { waitUntil: 'domcontentloaded', timeout: 45_000 });
                pages.push(await extractPage(page, td));
                const links = await discoverLinks(page, origin);
                for (const link of links) if (!visited.has(link)) queue.push(link);
            } catch (err) {
                process.stderr.write(`  ! skipped: ${(err as Error).message}\n`);
            }
            await page.waitForTimeout(delayMs);
        }
    } finally {
        await browser.close();
    }

    const result: ScrapeResult = {
        startUrl: start,
        origin,
        totalPages: pages.length,
        pages,
    };

    const outPath = resolve(process.cwd(), out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(result, null, 2), 'utf8');
    process.stderr.write(`\nWrote ${pages.length} pages to ${outPath}\n`);
}

main().catch((err) => {
    process.stderr.write(`\nfailed: ${(err as Error).message}\n`);
    process.exit(1);
});
