/**
 * Post-process the takeout extractor output: rewrite [text](Page%20Name.html)
 * style internal links to the live archive routes derived from the manifest.
 *
 * Usage:
 *   pnpm --filter @cfo/migrate-google-site exec tsx src/rewrite-links.ts \
 *     --manifest takeout-manifest.json \
 *     --in       out/takeout.json \
 *     --out      out/takeout.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

interface ManifestItem {
    page: string;
    slug: string;
    kind?: 'season' | 'event' | 'recap' | 'page';
}

const ROUTES: Record<string, string> = {
    season: '/archive/seasons',
    event: '/archive/events',
    recap: '/archive/recaps',
    page: '/archive/pages',
};

function parseCliArgs() {
    const { values } = parseArgs({
        options: {
            manifest: { type: 'string' },
            in: { type: 'string' },
            out: { type: 'string' },
        },
    });
    if (!values.manifest || !values.in || !values.out) {
        throw new Error('--manifest, --in, --out are required');
    }
    return { manifest: values.manifest, inPath: values.in, outPath: values.out };
}

async function main() {
    const { manifest: manifestPath, inPath, outPath } = parseCliArgs();
    const manifest: { items: ManifestItem[] } = JSON.parse(
        await readFile(manifestPath, 'utf8'),
    );

    // Map "Page Name.html" → "/archive/<route>/<slug>".
    const linkMap = new Map<string, string>();
    for (const it of manifest.items) {
        const route = ROUTES[it.kind ?? 'recap'] ?? ROUTES.recap;
        linkMap.set(`${it.page}.html`, `${route}/${it.slug}`);
        linkMap.set(`${encodeURIComponent(it.page)}.html`, `${route}/${it.slug}`);
        // Google Sites also URL-encodes spaces as %20 (one form of encodeURIComponent).
        linkMap.set(it.page.replace(/ /g, '%20') + '.html', `${route}/${it.slug}`);
    }

    const data = JSON.parse(await readFile(resolve(inPath), 'utf8'));
    let rewrites = 0;
    let dropped = 0;

    for (const slug of Object.keys(data.results)) {
        const r = data.results[slug];
        // Match markdown link: [text](URL)
        r.bodyMd = r.bodyMd.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            (full: string, text: string, href: string) => {
                if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
                    return full;
                }
                if (href.endsWith('.html')) {
                    const mapped = linkMap.get(href);
                    if (mapped) {
                        rewrites += 1;
                        return `[${text}](${mapped})`;
                    }
                    // Internal takeout link with no migration target — drop the link, keep the text.
                    dropped += 1;
                    return text;
                }
                return full;
            },
        );
    }

    await writeFile(resolve(outPath), JSON.stringify(data, null, 2), 'utf8');
    console.log(`rewrote ${rewrites} internal links, dropped ${dropped}`);
}

main().catch((err) => {
    console.error(`failed: ${(err as Error).message}`);
    process.exit(1);
});
