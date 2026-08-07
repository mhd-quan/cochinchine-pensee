/**
 * tcp-fetch-covers — one-shot Astro integration.
 *
 * Downloads the book-cover images for src/content/books/ into
 * public/images/books/, normalises them with sharp (max 640px wide, JPEG),
 * and writes coverImage/coverWidth/coverHeight back into each book's JSON.
 *
 * Runs inside the dev-server process on 'astro:config:setup'. Idempotent:
 * a book whose cover file already exists on disk is skipped, so restarts
 * are free. Never throws — a failed book is reported in the result file
 * and keeps its typographic placeholder.
 *
 * Cover sources were researched per book (Vietnamese editions verified on
 * Tiki/Fahasa/publisher sites; English editions via Open Library/Wikipedia).
 * Remove this integration from astro.config.mjs once covers are in git.
 *
 * Result log: scripts/.fetch-covers-result.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'books');
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'books');
const RESULT_FILE = path.join(ROOT, 'scripts', '.fetch-covers-result.json');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Ordered URL candidates per book slug (first success wins). */
const MANIFEST = {
  'berlin-tat-dinh-luan-va-tu-do-lua-chon': [
    'https://salt.tikicdn.com/cache/w1200/media/catalog/product/b/i/bia-tat-dinh-luan-bia-1.u547.d20170227.t164643.305750.jpg',
    'https://bizweb.dktcdn.net/100/180/408/products/tat-dinh-luan-va-tu-do-lua-chon.png?v=1619768896593',
    'https://salt.tikicdn.com/media/catalog/product/b/i/bia-tat-dinh-luan-bia-1.u547.d20170227.t164643.305750.jpg',
  ],
  'fukuzawa-khuyen-hoc': [
    'https://bizweb.dktcdn.net/thumb/1024x1024/100/363/455/products/khuyenhocnew203-9aa74bdb-4cef-4500-bf53-2914c2e44f38.jpg?v=1727680877513',
    'https://salt.tikicdn.com/cache/w1200/ts/product/27/3b/f5/6b73e68a40ef5c321b73ea35bddf65f4.jpg',
    'https://www.netabooks.vn/Data/Sites/1/Product/18000/khuyen-hoc-fukuzawa-yukichi.jpg',
  ],
  'han-su-bien-mat-cua-nghi-thuc': [
    'https://salt.tikicdn.com/cache/w1200/ts/product/1e/b9/73/b7fe0a9d42015c153973b3332eeea3d8.jpg',
    'https://product.hstatic.net/1000273499/product/4_544d2df8cddd45ea85f2216f42e1be5c_1024x1024.jpg',
    'https://salt.tikicdn.com/ts/product/1e/b9/73/b7fe0a9d42015c153973b3332eeea3d8.jpg',
  ],
  'soloviev-sieu-ly-tinh-yeu': [
    'https://media.nxbtrithuc.com.vn/Picture/2022/2/18/image-20220218152335466.jpg',
    'https://salt.tikicdn.com/cache/w1200/ts/product/b5/80/94/7ac09c84047897e5a9839a2ddd5efb53.jpg',
    'https://www.netabooks.vn/Data/Sites/1/Product/44412/sieu-ly-tinh-yeu-bo-3-tap-.jpg',
  ],
  'bauerlein-the-dumbest-generation-grows-up': [
    'https://covers.openlibrary.org/b/id/13147108-L.jpg?default=false',
    'https://books.google.com/books/content?vid=ISBN9781684512930&printsec=frontcover&img=1&zoom=2',
  ],
  'burke-reflections-on-the-revolution-in-france': [
    'https://covers.openlibrary.org/b/id/103124-L.jpg?default=false',
    'https://covers.openlibrary.org/b/id/7141859-L.jpg?default=false',
  ],
  'scott-seeing-like-a-state': [
    // Work OL26241985W: only eng+cover editions are 7885357 (1998 Yale),
    // 8290759 (1999), 13320976 (2020). Turkish editions (12242192 etc.)
    // appear earlier in OL search and are wrong.
    'https://covers.openlibrary.org/b/id/7885357-L.jpg?default=false',
    'https://covers.openlibrary.org/b/id/8290759-L.jpg?default=false',
    'https://covers.openlibrary.org/b/id/13320976-L.jpg?default=false',
  ],
  'raspail-the-camp-of-the-saints': [
    'https://upload.wikimedia.org/wikipedia/en/f/fd/TheCampOfTheSaints.jpg',
    'https://covers.openlibrary.org/b/id/2080756-L.jpg?default=false',
  ],
  // Goodreads CDN URLs below were extracted from each book's Goodreads page —
  // the OL/Google Books fallbacks for these returned placeholders or the
  // audiobook jacket.
  'esolen-no-apologies': [
    'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1623864797i/58127276.jpg',
  ],
  'douthat-believe': [
    'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1721752376i/216052746.jpg',
  ],
  'hammer-israel-and-civilization': [
    'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1742500795i/230107463.jpg',
  ],
  'hamvas-a-bor-filozofiaja': [
    'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1578440287i/22745451.jpg',
  ],
};

async function fetchBuffer(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'image/*,*/*;q=0.8' },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4000) return { error: `too small (${buf.length}B)` };
    return { buf };
  } catch (err) {
    return { error: String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Google Books search → largest front-cover URL, for books with no static source. */
async function googleBooksCoverUrl(query) {
  try {
    const api = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`;
    const res = await fetch(api, { headers: { 'user-agent': UA } });
    if (!res.ok) return null;
    const data = await res.json();
    for (const item of data.items ?? []) {
      const thumb = item.volumeInfo?.imageLinks?.thumbnail;
      if (!thumb) continue;
      return thumb
        .replace(/^http:/, 'https:')
        .replace(/&edge=curl/, '')
        .replace(/zoom=1/, 'zoom=2');
    }
    return null;
  } catch {
    return null;
  }
}

async function processBook(sharp, slug, urls, results) {
  const outFile = path.join(OUT_DIR, `${slug}.jpg`);
  const jsonFile = path.join(CONTENT_DIR, `${slug}.json`);

  // Idempotence: cover already on disk → only make sure the JSON points at it.
  let existing = null;
  try {
    existing = await fs.stat(outFile);
  } catch {}

  let candidates = [...urls];
  if (candidates.length === 0 && slug === 'hamvas-a-bor-filozofiaja') {
    const dynamic = await googleBooksCoverUrl('a bor filozófiája hamvas');
    if (dynamic) candidates = [dynamic, dynamic.replace(/zoom=2/, 'zoom=1')];
  }

  let picked = null;
  let width = 0;
  let height = 0;
  const attempts = [];

  if (existing) {
    picked = 'already-on-disk';
    const meta = await sharp(outFile).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } else {
    for (const url of candidates) {
      const { buf, error } = await fetchBuffer(url);
      if (!buf) {
        attempts.push(`${url} → ${error}`);
        continue;
      }
      try {
        const image = sharp(buf, { failOn: 'error' });
        const meta = await image.metadata();
        if (!meta.width || !meta.height || meta.width < 220 || meta.height < 220) {
          attempts.push(`${url} → tiny image ${meta.width}x${meta.height}`);
          continue;
        }
        const out = await image
          .resize({ width: 640, withoutEnlargement: true })
          .flatten({ background: '#FAFAF7' })
          .jpeg({ quality: 86, mozjpeg: true })
          .toBuffer();
        const outMeta = await sharp(out).metadata();
        await fs.writeFile(outFile, out);
        picked = url;
        width = outMeta.width ?? 0;
        height = outMeta.height ?? 0;
        break;
      } catch (err) {
        attempts.push(`${url} → decode failed: ${String(err?.message ?? err)}`);
      }
    }
  }

  if (!picked) {
    results[slug] = { ok: false, attempts };
    return;
  }

  // Point the content JSON at the local file, with intrinsic dimensions.
  try {
    const record = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
    record.coverImage = `/images/books/${slug}.jpg`;
    record.coverWidth = width;
    record.coverHeight = height;
    await fs.writeFile(jsonFile, `${JSON.stringify(record, null, 2)}\n`);
    results[slug] = { ok: true, source: picked, width, height };
  } catch (err) {
    results[slug] = { ok: false, attempts: [`json update failed: ${String(err?.message ?? err)}`] };
  }
}

async function run(logger) {
  const results = {};
  try {
    const sharp = (await import('sharp')).default;
    await fs.mkdir(OUT_DIR, { recursive: true });

    // Small start stagger keeps the CDNs friendly.
    await Promise.allSettled(
      Object.entries(MANIFEST).map(
        ([slug, urls], index) =>
          new Promise((resolve) => {
            setTimeout(() => {
              processBook(sharp, slug, urls, results).then(resolve, (err) => {
                results[slug] = { ok: false, attempts: [String(err?.message ?? err)] };
                resolve(undefined);
              });
            }, index * 250);
          }),
      ),
    );
  } catch (err) {
    results.__fatal = String(err?.message ?? err);
  }

  try {
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(results, null, 2)}\n`);
  } catch {}

  const okCount = Object.values(results).filter((r) => r && r.ok).length;
  // Detailed per-book log so dev.log reveals which URLs succeeded vs. failed.
  for (const [slug, r] of Object.entries(results)) {
    if (!r || r.ok) continue;
    logger?.warn?.(`tcp-fetch-covers: ${slug} failed — ${JSON.stringify(r.attempts ?? [])}`);
  }
  logger?.info?.(`tcp-fetch-covers: ${okCount} covers ready (see scripts/.fetch-covers-result.json)`);
}

export default function fetchCovers() {
  return {
    name: 'tcp-fetch-covers',
    hooks: {
      'astro:config:setup': async ({ logger }) => {
        await run(logger);
      },
    },
  };
}
