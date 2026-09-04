import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import remarkParse from 'remark-parse';
import sharp from 'sharp';
import { unified } from 'unified';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT = path.join(ROOT, 'public/images/responsive');
const CACHE = path.join(ROOT, '.cache/image-sources');
const MANIFEST = path.join(ROOT, '.astro/responsive-images.json');
const WIDTHS = [160, 240, 320, 400, 480, 640, 800, 1200, 1600];
const QUALITY = 78;
const AVIF_QUALITY = 55;
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 20);
const markdown = unified().use(remarkParse);

function visit(node, callback) {
  callback(node);
  for (const child of node.children ?? []) visit(child, callback);
}

async function writeIfChanged(filename, contents) {
  const previous = await fs.readFile(filename, 'utf8').catch(() => null);
  if (previous !== contents) await fs.writeFile(filename, contents);
}

async function collectSources() {
  const sources = new Set();
  const essays = path.join(ROOT, 'src/content/essays');
  for (const filename of (await fs.readdir(essays, { recursive: true })).sort()) {
    if (!/\.mdx?$/.test(filename)) continue;
    const text = await fs.readFile(path.join(essays, filename), 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!frontmatter) continue;
    const data = parse(frontmatter[1]);
    if (data.draft) continue;
    const source = data.coverImage ?? data.cover_image;
    if (source) sources.add(source);
    const tree = markdown.parse(text.slice(frontmatter[0].length));
    const definitions = new Map();
    visit(tree, (node) => {
      if (node.type === 'definition') definitions.set(node.identifier, node.url);
    });
    visit(tree, (node) => {
      if (node.type === 'image') sources.add(node.url);
      if (node.type === 'imageReference' && definitions.has(node.identifier)) {
        sources.add(definitions.get(node.identifier));
      }
    });
  }
  const books = path.join(ROOT, 'src/content/books');
  for (const filename of (await fs.readdir(books)).sort()) {
    if (!filename.endsWith('.json')) continue;
    const data = JSON.parse(await fs.readFile(path.join(books, filename), 'utf8'));
    if (data.coverImage) sources.add(data.coverImage);
  }
  return [...sources].sort();
}

async function readSource(source, refresh) {
  if (source.startsWith('/images/') && !source.includes('..')) {
    return fs.readFile(path.join(ROOT, 'public', source));
  }
  const url = new URL(source);
  if (url.protocol !== 'https:') throw new Error('Image sources must use HTTPS or /images/');
  const cachedFile = path.join(CACHE, `${hash(source)}.bin`);
  if (!refresh) {
    const cached = await fs.readFile(cachedFile).catch(() => null);
    if (cached) return cached;
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    // Ask image CDNs to deliver a format Sharp can decode, including HEIC sources.
    headers: { accept: 'image/webp,image/jpeg,image/png;q=0.9' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url.hostname}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  // Validate before caching, so an HTML error response cannot poison later builds.
  await sharp(buffer, { failOn: 'error' }).metadata();
  await fs.writeFile(cachedFile, buffer);
  return buffer;
}

async function transformSource(source, refresh) {
  const buffer = await readSource(source, refresh);
  const metadata = await sharp(buffer).metadata();
  const { width, height } = metadata.autoOrient;
  if (!width || !height) throw new Error(`Missing image dimensions: ${source}`);
  const maximum = Math.min(width, WIDTHS.at(-1));
  const widths = [...new Set([...WIDTHS.filter((size) => size < maximum), maximum])];
  // Content and encoder settings participate in the URL: replacing an original
  // cannot leave stale browser/CDN variants behind.
  const key = hash(
    Buffer.concat([
      buffer,
      Buffer.from(
        JSON.stringify({
          quality: QUALITY,
          avifQuality: AVIF_QUALITY,
          encoder: sharp.versions,
          orientation: true,
        }),
      ),
    ]),
  );
  const variants = [];
  const avifVariants = [];
  for (const size of widths) {
    for (const format of ['webp', 'avif']) {
      const name = `${key}-${size}.${format}`;
      const output = path.join(OUTPUT, name);
      if (!(await fs.stat(output).catch(() => null))) {
        const temporary = `${output}.${randomUUID()}.tmp`;
        const image = sharp(buffer).autoOrient().resize({ width: size, withoutEnlargement: true });
        await (format === 'webp'
          ? image.webp({ quality: QUALITY, effort: 6 })
          : image.avif({ quality: AVIF_QUALITY, effort: 4 })
        ).toFile(temporary);
        await fs.rename(temporary, output);
      }
      (format === 'webp' ? variants : avifVariants).push({
        src: `/images/responsive/${name}`,
        width: size,
      });
    }
  }
  return { width, height, variants, avifVariants };
}

export async function generateResponsiveImages({ refresh = false, logger = console } = {}) {
  await Promise.all([
    fs.mkdir(OUTPUT, { recursive: true }),
    fs.mkdir(CACHE, { recursive: true }),
    fs.mkdir(path.dirname(MANIFEST), { recursive: true }),
  ]);
  const sources = await collectSources();
  const entries = new Map();
  let next = 0;
  // Bound both CDN requests and image decoding memory on CI builders.
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < sources.length) {
        const source = sources[next++];
        entries.set(source, await transformSource(source, refresh));
      }
    }),
  );
  const manifest = Object.fromEntries(sources.map((source) => [source, entries.get(source)]));
  await writeIfChanged(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  logger.info(`Responsive images: ${sources.length} sources ready (AVIF + WebP, up to 1600px).`);
}

export default function responsiveImages() {
  return {
    name: 'tcp-responsive-images',
    hooks: {
      'astro:config:setup': async ({ logger }) => {
        await generateResponsiveImages({ logger });
      },
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateResponsiveImages({ refresh: process.argv.includes('--refresh') });
}
