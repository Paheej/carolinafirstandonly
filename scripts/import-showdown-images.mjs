#!/usr/bin/env node
// One-off: upload Showdown at Snyder's event images to ImageKit.
//
// The original Google Sites URLs (lh3.googleusercontent.com/sitesv/…) are session-gated
// and return 400/403 to both ImageKit's URL importer and a plain fetch. So this version
// uploads from the user's local Google Takeout export, mapping hash-named JPGs to the
// human fileNames the markdown will reference.
//
// Mapping was derived by reading the takeout HTML and matching each <img> to the caption
// the user specified for each fileName.
//
// Env (reads either naming):
//   IMAGEKIT_PRIVATE_KEY            (required)
//   IMAGEKIT_PUBLIC_KEY      or NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY    (optional, info only)
//   IMAGEKIT_URL_ENDPOINT    or NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT  (optional, info only)
//
// Usage:
//   node --env-file=apps/web/.env.local scripts/import-showdown-images.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Buffer } from 'node:buffer';

const PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
const PUBLIC_KEY =
  process.env.IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const URL_ENDPOINT =
  process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

if (!PRIVATE_KEY) {
  console.error('Missing IMAGEKIT_PRIVATE_KEY');
  process.exit(1);
}

const FOLDER = '/events/showdown-at-snyders/';
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

const TAKEOUT_DIR =
  process.env.SHOWDOWN_TAKEOUT_DIR ||
  path.join(
    os.homedir(),
    'Downloads/Takeout/Drive/sites/Copy of www.carolinafirstandonly.com/DRAFT/Showdown at Snyders',
  );

// Original external URLs (kept for the record / re-import fallback).
const EXTERNAL_URLS = {
  'round-one-knight-shelling.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUC4j9ltHria49eqeciq_hBjCGgwdDCx6_JE3EmgE-rewrkPycRRg9EIPbE-o6V1zLmnWn1v0NGblUjUxL-9ti0T67a0ipoJNchgurvvWE3NZaAwB1ZD66wTGY0kIujgXmAxu6O3S__pjVyajngyQQ2VuYsKhaki1mzAUgPXZtVXmEWFfN1tP_EvqsK8sq2Ix7NjOnIWU6_RX_32sb8y8DMuTHSz6CIMxUX6CVr6kNg=w1280',
  'round-two-belakor-1.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUCP5BWLokHlI-ggAuOabaJOofNqe8HieBOvfxrH-DdQx_894cAVf8bOmhoCQ-HgemtjGtPMA7RLmnZoPn1RsC5BBlzaE0ilfPeYW4cATE44CS7i9LDnpFj3sUUDhm4oi61lPTxEElsfjfgeyL8xcUFXukqxubGOUE1--CTe73rgLiTKD8fJosgXge8o3qzhX2OYIufgWGHS64GYkJYXTfY8PLo2cK57lNfw3_FentI=w1280',
  'round-two-belakor-2.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBKnnGHAp-y4h-YOzBOTuw0vh9KjS8OvAcHXqZYApXH835Zt0sCKNEiWzfQOKWFvEHOK1WbHk0aUK-L1--HOq8NhrjFby6a-WmaTltsH8pL6JrZSbqQ9t6A_8M_-a1TzIbiIhcuIZQKSUu61sQLiOgvzgzxDbVJaujyVRi33tMBOjc__W2PF3TfFOtZiMqIfVvXlypmqAbe_UmyHY6hiKDEIq37LWrDaUcV81RpaP0=w1280',
  'round-two-belakor-3.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUA3KsEOzS68bqS07x9Jw2TCq93566yTz_XGvFb9eMtlgqt5QB3ekJen9CgocHoYGn95aaN6761Ftn1H-tkfbfTMcMGzFheOI7OlQqw5InjslvcNYEu7tvE1Ql3bFbi_1KBa00AAQ4HPiPuqhBcTZ8FgErp6Hh_J-IdLeIQxUfkAxMRNYxmzASWJca1B2PichRzxkL0TvivWTOLIhPUuibfuy2BppR04w0T1kaFPDTM=w1280',
  'final-factory-capture.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUAhAeW9KLDpNrTpMHJ1Pq5Z_b6mtWvcvdRXfrCw0SutumYTPsVPhBtn_IenHcFqH1V_SIlQ71-UuSJELyGkFhrsTdrxVYftuu1nryx2tOtQjQwsRkQ8s3-JvEN6evc5CoU90k0XiXpg8Td0Ox99fCCzuE3k3sX6kK_0QZGtAWWMIIPp9sH22DLaNrsJ9xBCIwQgylYf-f_wMZ-7em39rvSApZ3_JQq_L1vlQGMU=w1280',
  'final-imperial-deploy.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBZ08tumFG1zT4iLN4Z43ZtdzS17CgDDvtlVqlXtGKxizLOi5QNSbzWr4GKrI_PmxWGUDXlagWeA075VToxqU9pwUKczUAtHl0Iq9o8XTRvY7vQnsxxsnD9a7EjwfRCgidi-W0N6dbCOJkWTnt_zKga3IJ-4ZrSidh7qvNFO_Ijj962KsGv9k9goJLWxl45kk_nis7qztcREb5RlJvTNL1FCNFJVne0biZ_FY0vf4g=w1280',
  'final-vindicare.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBMgspNitLEewlIZAnyZ9iLig6izHWsrointduqttlzqmaBS5Hqs7smf0StsyZEqWY4tb5mEkSLndsNsxp7LF-KrBe8f9KQfN44v-2XO8P8qNDgybeihRcQeSRECw7WV4_f7VgOfbW8uflER__ggfZX5J8gQc8RxdE34aAK94HR9Vuk1eZ6ST9uJba2PELjjsuLMmROffDdc1PPVdWkRJtV0k3SvPaVlToYPx_0=w1280',
  'final-grizz-terminators.jpg':
    'https://lh3.googleusercontent.com/sitesv/AA5AbUCt9t4xsvZby_HTpl70aX1q-QSkda3DWODdTx4YihW7QeakHeKsCctfMdz3I06_e-F14-FB3ofeuYUhLoKELWU4A-3ec9bvvrhyRxH5zos-g-94m8X18Pb2XtNSBS7TpZ-rPnCDoXSg1zEWXg6gkFGHgPWMlyKI0NHgUKSo8XpyvQMN07akdsPj3Th6loWIPBY_NH94lGpQhdyJnOzjbE5QcWeFnr2vXUVpdB4mRyU=w1280',
  // 9th image: no original external URL captured; upload from local takeout only.
  'final-baneblade-down.jpg': null,
};

// Mapping from desired fileName → local takeout file (hash-named).
// Derived by reading the takeout HTML and matching each <img> to its caption.
const TAKEOUT_MAP = {
  'round-one-knight-shelling.jpg': 'af6c66462624eed37aff62c3220693cf.jpg',
  'round-two-belakor-1.jpg':       '1048868479b84459831fc03c0cc4f4ac.jpg',
  'round-two-belakor-2.jpg':       'e169a93c242f4fc554a3fac8df51169f.jpg',
  'round-two-belakor-3.jpg':       'a60b6d9c2fd4c5b8484fc68635518f9c.jpg',
  'final-factory-capture.jpg':     '02c1689ff965f48873967717d9fd581d.jpg',
  'final-imperial-deploy.jpg':     'f0977062f9fc5220101e487630a7fbf8.jpg',
  'final-vindicare.jpg':           '663bad28d5b0bbc3f3663a09da5eba25.jpg',
  'final-baneblade-down.jpg':      '45aa3c33355d7544174c3c3cc4a1cbfb.jpg',
  'final-grizz-terminators.jpg':   'babff43cf82abac08ab773c8a6a3a32a.jpg',
};

const authHeader = 'Basic ' + Buffer.from(PRIVATE_KEY + ':').toString('base64');

async function uploadFromUrl(fileName, externalUrl) {
  const form = new FormData();
  form.append('file', externalUrl);
  form.append('fileName', fileName);
  form.append('folder', FOLDER);
  form.append('useUniqueFileName', 'false');
  form.append('overwriteFile', 'true');

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`URL upload failed [${res.status}]: ${text}`);
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}

async function uploadFromFile(fileName, filePath) {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('fileName', fileName);
  form.append('folder', FOLDER);
  form.append('useUniqueFileName', 'false');
  form.append('overwriteFile', 'true');

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`file upload failed [${res.status}]: ${text}`);
  }
  return JSON.parse(text);
}

const results = {};
const errors = [];

console.log(`ImageKit endpoint: ${URL_ENDPOINT || '(not set in env)'}`);
console.log(`Public key:        ${PUBLIC_KEY ? PUBLIC_KEY.slice(0, 16) + '…' : '(not set)'}`);
console.log(`Folder:            ${FOLDER}`);
console.log(`Source:            ${TAKEOUT_DIR}`);
console.log(`Images:            ${Object.keys(TAKEOUT_MAP).length}`);
console.log('---');

for (const [fileName, hashName] of Object.entries(TAKEOUT_MAP)) {
  process.stdout.write(`→ ${fileName} ... `);

  // Try external URL import first (per task spec). Falls back to local file on any error.
  const externalUrl = EXTERNAL_URLS[fileName];
  if (externalUrl) {
    try {
      const r = await uploadFromUrl(fileName, externalUrl);
      results[fileName] = r.url;
      console.log(`OK (url import) ${r.url}`);
      continue;
    } catch (e1) {
      process.stdout.write(`url import failed (${e1.status || '?'}), trying local file ... `);
    }
  } else {
    process.stdout.write(`no external url, using local file ... `);
  }

  const localPath = path.join(TAKEOUT_DIR, hashName);
  if (!fs.existsSync(localPath)) {
    console.log(`MISSING ${localPath}`);
    errors.push({ fileName, error: `local file not found: ${localPath}` });
    continue;
  }

  try {
    const r = await uploadFromFile(fileName, localPath);
    results[fileName] = r.url;
    console.log(`OK ${r.url}`);
  } catch (e2) {
    console.log(`FAILED: ${e2.message}`);
    errors.push({ fileName, error: e2.message });
  }
}

console.log('\n=== RESULTS ===');
console.log(JSON.stringify(results, null, 2));

if (errors.length) {
  console.log('\n=== ERRORS ===');
  console.log(JSON.stringify(errors, null, 2));
  process.exit(1);
}
