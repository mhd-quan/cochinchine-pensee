/**
 * normalize-cover — validate + normalise one downloaded book-cover image.
 *
 * Usage: node scripts/normalize-cover.mjs <input-image> <slug>
 *
 * Rejects non-portrait or tiny images, resizes to max 640px wide JPEG,
 * writes public/images/books/<slug>.jpg, and syncs coverWidth/coverHeight
 * into src/content/books/<slug>.json. Prints "OK <slug>: WxH → WxH".
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [input, slug] = process.argv.slice(2);

if (!input || !slug) {
  console.error('usage: node scripts/normalize-cover.mjs <input-image> <slug>');
  process.exit(1);
}

const sharp = (await import('sharp')).default;
const buf = await fs.readFile(input);
const meta = await sharp(buf).metadata();

if (!meta.width || !meta.height) throw new Error('cannot decode image');
const ratio = meta.width / meta.height;
if (ratio < 0.4 || ratio > 0.95) {
  throw new Error(`suspicious ratio ${meta.width}x${meta.height} — not a portrait book cover`);
}
if (meta.height < 500) throw new Error(`too small: ${meta.width}x${meta.height}`);

const out = await sharp(buf)
  .resize({ width: 640, withoutEnlargement: true })
  .flatten({ background: '#FAFAF7' })
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();
const outMeta = await sharp(out).metadata();

const outFile = path.join(ROOT, 'public', 'images', 'books', `${slug}.jpg`);
await fs.writeFile(outFile, out);

const jsonFile = path.join(ROOT, 'src', 'content', 'books', `${slug}.json`);
const record = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
record.coverImage = `/images/books/${slug}.jpg`;
record.coverWidth = outMeta.width;
record.coverHeight = outMeta.height;
await fs.writeFile(jsonFile, `${JSON.stringify(record, null, 2)}\n`);

console.log(`OK ${slug}: ${meta.width}x${meta.height} → ${outMeta.width}x${outMeta.height}`);
