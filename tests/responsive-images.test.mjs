import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('.astro/responsive-images.json', root), 'utf8'));

test('every advertised AVIF and WebP candidate is deployed with the promised dimensions', async () => {
  for (const [source, image] of Object.entries(manifest)) {
    assert.deepEqual(
      image.avifVariants.map((v) => v.width),
      image.variants.map((v) => v.width),
      source,
    );
    for (const variant of [...image.variants, ...image.avifVariants]) {
      const file = new URL(`dist${variant.src}`, root);
      assert.ok((await stat(file)).size > 0, variant.src);
      const metadata = await sharp(fileURLToPath(file)).metadata();
      assert.equal(metadata.width, variant.width, variant.src);
      assert.ok(variant.width <= image.width, `Must not upscale ${source}`);
      assert.ok(
        Math.abs(metadata.height - (variant.width * image.height) / image.width) <= 1,
        variant.src,
      );
      assert.equal(metadata.format, variant.src.endsWith('.webp') ? 'webp' : 'heif', variant.src);
    }
  }
});

test('the homepage LCP image retains early priority and a working WebP fallback', async () => {
  const home = await readFile(new URL('dist/index.html', root), 'utf8');
  const picture = home.match(/<picture\b[^>]*>(.*?)<\/picture>/s)[1];
  const source = picture.match(/<source\b[^>]*>/)[0];
  const image = picture.match(/<img\b[^>]*>/)[0];
  assert.match(source, /type="image\/avif"/);
  assert.match(image, /src="[^"]+\.webp"/);
  assert.match(image, /loading="eager"/);
  assert.match(image, /fetchpriority="high"/);
  assert.equal(source.match(/sizes="([^"]+)"/)[1], image.match(/sizes="([^"]+)"/)[1]);
});
