# @cfo/migrate-google-site

One-off scraper for the existing `carolinafirstandonly.com` (currently a
Google Sites instance). Produces a single JSON file with each page rendered
to markdown plus a list of image URLs, so the content can be reviewed and
edited before being seeded into the Supabase archive tables.

## Run

```bash
cd tools/migrate-google-site
pnpm install
pnpm exec playwright install chromium      # one-time

pnpm scrape -- \
  --start https://sites.google.com/view/carolinafirstandonly \
  --out ./out/scrape.json
```

Optional flags: `--max-pages 60`, `--delay 500` (ms between page loads).

## Output shape

```jsonc
{
    "startUrl": "...",
    "origin": "...",
    "totalPages": 18,
    "pages": [
        {
            "url": "...",
            "title": "Season 1 - Crusade Recap",
            "heading": "Season 1 — Crusade Recap",
            "markdown": "## Week 1...",
            "images": [{ "src": "https://...", "alt": "Battle line" }],
            "crawledAt": "2026-05-23T14:21:09.331Z"
        }
    ]
}
```

## What to do with the JSON

1. Open the file, prune pages that aren't real content (login pages,
   thank-you pages, etc.).
2. For each season / special event, decide which scraped pages map to
   which archive entry, edit the markdown to your liking.
3. Re-upload images to ImageKit (the scraper doesn't move binaries —
   the URLs in `images[]` are the Google-hosted originals; do this with the
   PhotoUploader once a recap exists, or via ImageKit's web UI).
4. Write `0005_seed_archive_content.sql` that `UPDATE`s the season /
   `archive_events` shells from `0004_seed_archive_shells.sql` with the
   reviewed markdown + image URLs.
