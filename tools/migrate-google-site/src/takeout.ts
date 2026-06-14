/**
 * Takeout extractor: reads Google-Sites Takeout HTML pages from disk,
 * uploads referenced images to ImageKit, and emits a manifest mapping each
 * target archive slug to its cleaned markdown + image URLs.
 *
 * Usage (from repo root):
 *   pnpm --filter @cfo/migrate-google-site exec tsx src/takeout.ts \
 *     --manifest tools/migrate-google-site/takeout-manifest.json \
 *     --out      tools/migrate-google-site/out/takeout.json
 *
 * Env (reads either naming):
 *   IMAGEKIT_PRIVATE_KEY            (required)
 *   NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT / IMAGEKIT_URL_ENDPOINT (info only)
 *
 * Manifest shape: see ManifestItem below. Each item points at a *.html file
 * in the Takeout export; sibling folder of the same base name holds the
 * image binaries.
 *
 * Output shape: { startedAt, results: Record<slug, ExtractResult>, errors }
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, basename, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Buffer } from 'node:buffer';
import TurndownService from 'turndown';
// @ts-expect-error: no types
import { gfm } from 'turndown-plugin-gfm';

interface ManifestItem {
    /** Page basename without extension, e.g. "S2 - Battle Report Entrapment". */
    page: string;
    /** Archive slug this content will land on. */
    slug: string;
    /** ImageKit folder, e.g. "/recaps/s2-battle-report-entrapment/". */
    imagekitFolder: string;
    /** Optional override for the page title; defaults to the H1 / page name. */
    title?: string;
    /** Optional: which kind of archive row this maps to. Informational only. */
    kind?: 'season' | 'event' | 'recap' | 'page';
}

interface Manifest {
    /** Path to the takeout DRAFT directory containing the .html files. */
    takeoutDir: string;
    items: ManifestItem[];
}

interface ExtractResult {
    page: string;
    slug: string;
    title: string;
    bodyMd: string;
    heroImageUrl: string | null;
    uploads: Record<string, string>;
    imageCount: number;
}

const PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
if (!PRIVATE_KEY) {
    console.error('Missing IMAGEKIT_PRIVATE_KEY');
    process.exit(1);
}
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const authHeader = 'Basic ' + Buffer.from(PRIVATE_KEY + ':').toString('base64');

function parseCliArgs() {
    const { values } = parseArgs({
        options: {
            manifest: { type: 'string' },
            out: { type: 'string', default: './out/takeout.json' },
        },
        allowPositionals: false,
    });
    if (!values.manifest) throw new Error('--manifest <path> is required');
    return { manifest: values.manifest, out: values.out! };
}

function makeTurndown(): TurndownService {
    const td = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '_',
    });
    td.use(gfm);
    td.remove(['script', 'style', 'noscript', 'iframe']);
    return td;
}

/**
 * Pull just the body content from a Google Sites takeout HTML page,
 * minus the repeated nav and the footer disclaimer. Google Sites uses
 * spans inside <h1> for styling, so we just cut from the last <h1 tag
 * (the page heading) to wherever the footer disclaimer starts.
 */
function extractBodyHtml(html: string): string {
    let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;

    // Drop big <script>/<style> blocks before turndown sees them.
    body = body.replace(/<script[\s\S]*?<\/script>/gi, '');
    body = body.replace(/<style[\s\S]*?<\/style>/gi, '');
    body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    // Takeout pages have one element with role="main" wrapping the actual
    // content; everything before it is the repeated site nav. Cut from the
    // *enclosing* tag of role="main" so the wrapping element is preserved.
    const mainAttr = body.indexOf('role="main"');
    if (mainAttr > 0) {
        // Walk back to the opening '<' of the tag carrying role="main".
        const tagOpen = body.lastIndexOf('<', mainAttr);
        if (tagOpen >= 0) body = body.slice(tagOpen);
    }

    // Strip the boilerplate footer that ends every page:
    //   "Carolina First and Only - The best tabletop 40k group in North
    //    Carolina. This is not an official Games Workshop Website.
    //    Indeed this is actually better. 2024."
    body = body.replace(
        /Carolina First (?:and|&amp;) Only[^<]{0,300}better\.[^<]{0,30}\d{4}\.?/i,
        '',
    );

    return body;
}

const MIME = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
} as const;

async function uploadImage(
    filePath: string,
    fileName: string,
    folder: string,
): Promise<string> {
    const buf = await readFile(filePath);
    const ext = extname(fileName).toLowerCase() as keyof typeof MIME;
    const mime = MIME[ext] ?? 'application/octet-stream';
    const blob = new Blob([buf], { type: mime });
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('fileName', fileName);
    form.append('folder', folder);
    form.append('useUniqueFileName', 'false');
    form.append('overwriteFile', 'true');

    const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: form,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`upload [${res.status}]: ${text}`);
    return JSON.parse(text).url as string;
}

async function processItem(
    item: ManifestItem,
    takeoutDir: string,
    td: TurndownService,
): Promise<ExtractResult> {
    const htmlPath = join(takeoutDir, `${item.page}.html`);
    const assetDir = join(takeoutDir, item.page);

    const html = await readFile(htmlPath, 'utf8');
    let body = extractBodyHtml(html);

    // Find all <img src="LocalPath"> in order.
    const imgRe = /<img[^>]*\bsrc="([^"]+)"[^>]*>/gi;
    const seenSrcs: string[] = [];
    const uploads: Record<string, string> = {};
    let firstImage: string | null = null;

    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(body)) !== null) {
        const src = m[1];
        if (src && !seenSrcs.includes(src)) seenSrcs.push(src);
    }

    for (let i = 0; i < seenSrcs.length; i++) {
        const src = seenSrcs[i];
        if (!src || src.startsWith('data:') || src.startsWith('http')) continue;
        const decoded = decodeURIComponent(src);
        const localName = basename(decoded);
        const localPath = join(takeoutDir, decoded);
        try {
            await stat(localPath);
        } catch {
            // Fall back to assetDir/<basename> in case the URL escaping is odd
            const alt = join(assetDir, localName);
            try {
                await stat(alt);
            } catch {
                console.error(`  ! missing: ${localPath}`);
                continue;
            }
        }

        const ext = extname(localName).toLowerCase() || '.jpg';
        const targetName = `image-${i + 1}${ext}`;
        process.stdout.write(`    → ${item.slug}/${targetName} `);
        try {
            const url = await uploadImage(
                (await stat(localPath).then(() => localPath).catch(() => join(assetDir, localName))),
                targetName,
                item.imagekitFolder,
            );
            uploads[src] = url;
            if (!firstImage) firstImage = url;
            process.stdout.write('✓\n');
        } catch (e) {
            process.stdout.write(`fail: ${(e as Error).message}\n`);
        }
    }

    // Swap every <img src="LocalPath"> for the ImageKit URL.
    body = body.replace(imgRe, (full, src) => {
        const url = uploads[src];
        if (!url) return ''; // strip if upload failed / unmapped
        return `<img src="${url}" alt="" />`;
    });

    // Drop the Google Sites footer disclaimer that ends every page.
    body = body.replace(
        /Carolina First and Only[\s\S]*?(?:better\.|2024\.|2025\.|2026\.)/i,
        '',
    );

    const markdown = td.turndown(body).trim();
    const title = item.title ?? item.page;

    return {
        page: item.page,
        slug: item.slug,
        title,
        bodyMd: markdown,
        heroImageUrl: firstImage,
        uploads,
        imageCount: Object.keys(uploads).length,
    };
}

async function main() {
    const { manifest: manifestPath, out } = parseCliArgs();
    const manifest: Manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const takeoutDir = resolve(manifest.takeoutDir);
    const td = makeTurndown();

    const results: Record<string, ExtractResult> = {};
    const errors: { slug: string; error: string }[] = [];

    console.log(`takeout dir: ${takeoutDir}`);
    console.log(`items:       ${manifest.items.length}`);
    console.log('---');

    for (const item of manifest.items) {
        console.log(`>> ${item.slug} (${item.page})`);
        try {
            const r = await processItem(item, takeoutDir, td);
            results[item.slug] = r;
            console.log(`   ${r.imageCount} image(s), ${r.bodyMd.length} chars markdown`);
        } catch (e) {
            const msg = (e as Error).message;
            console.error(`   ! ${msg}`);
            errors.push({ slug: item.slug, error: msg });
        }
    }

    const outPath = resolve(out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(
        outPath,
        JSON.stringify(
            { startedAt: new Date().toISOString(), results, errors },
            null,
            2,
        ),
        'utf8',
    );
    console.log(`\nWrote ${Object.keys(results).length} results to ${outPath}`);
    if (errors.length) console.log(`Errors: ${errors.length}`);
}

main().catch((err) => {
    console.error(`failed: ${(err as Error).message}`);
    process.exit(1);
});
