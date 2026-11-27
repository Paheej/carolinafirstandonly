/**
 * Full-page screenshots at desktop (1366px) and phone (390px) widths, and a
 * check for horizontal overflow (scrollWidth wider than the viewport).
 *
 *   pnpm shots                                   # localhost:3000, default pages
 *   pnpm shots --base https://new.carolinafirstandonly.com / /events /groups
 *   OUT=/tmp/shots pnpm shots
 *
 * First run on a new machine: npx playwright install chromium-headless-shell
 * Signed-in pages need a real session; use Claude in Chrome for those.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const baseIdx = args.indexOf('--base');
const base = baseIdx > -1 ? args.splice(baseIdx, 2)[1] : 'http://localhost:3000';
const paths = args.length ? args : ['/', '/archive', '/events', '/groups', '/privacy', '/auth/login'];
const out = process.env.OUT ?? new URL('./out', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
let overflow = 0;
for (const [width, height, tag] of [[1366, 900, 'desktop'], [390, 844, 'phone']]) {
    const page = await browser.newPage({ viewport: { width, height } });
    for (const p of paths) {
        const res = await page.goto(base + p, { waitUntil: 'networkidle', timeout: 90000 });
        await page.evaluate(async () => {
            for (const img of document.images) img.loading = 'eager';
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise((r) => setTimeout(r, 600));
            window.scrollTo(0, 0);
        });
        await page.waitForTimeout(1200);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        if (sw > width) overflow++;
        const name = (p === '/' ? 'home' : p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-')) + `-${tag}.png`;
        await page.screenshot({ path: `${out}/${name}`, fullPage: true });
        console.log(`${tag.padEnd(7)} ${String(res?.status()).padEnd(4)} ${sw > width ? `OVERFLOW ${sw}px` : 'ok'}  ${p}  -> ${out}/${name}`);
    }
    await page.close();
}
await browser.close();
process.exit(overflow ? 1 : 0);
