import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { fontCodePoints, unicodeRange } from './font-coverage.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.astro/fonts');
const families = ['source-serif-4', 'eb-garamond', 'be-vietnam-pro'];
const styles = {
  'source-serif-4': ['400', '400-italic', '600', '700'],
  'eb-garamond': ['400', '400-italic', '600', '700'],
  'be-vietnam-pro': ['400', '500', '600', '700'],
};
const localFaces = [
  {
    family: 'playfair-display-sc',
    cssFamily: 'Playfair Display SC',
    style: '400',
    source: 'src/assets/fonts/playfair-display-sc/PlayfairDisplaySC-Regular.ttf',
    fontStyle: 'normal',
    fontWeight: '400',
    characters: 'titles',
  },
  {
    family: 'playfair-display-sc',
    cssFamily: 'Playfair Display SC',
    style: '700',
    source: 'src/assets/fonts/playfair-display-sc/PlayfairDisplaySC-Bold.ttf',
    fontStyle: 'normal',
    fontWeight: '700',
    characters: 'titles',
    preloadRole: 'essay-title',
  },
  {
    family: 'bricolage-grotesque',
    cssFamily: 'Bricolage Grotesque',
    style: '400',
    source: 'src/assets/fonts/bricolage-grotesque/BricolageGrotesque-Regular.ttf',
    fontStyle: 'normal',
    fontWeight: '400',
    characters: 'publication',
  },
  {
    family: 'bricolage-grotesque',
    cssFamily: 'Bricolage Grotesque',
    style: '600',
    source: 'src/assets/fonts/bricolage-grotesque/BricolageGrotesque-SemiBold.ttf',
    fontStyle: 'normal',
    fontWeight: '600',
    characters: 'publication',
  },
];

// Keep common Latin, all Vietnamese letters and combining marks even if the
// current issue does not use them. Other scripts are collected from source.
export async function publicationCharacters() {
  let text = '';
  for (const [start, end] of [
    [0x20, 0x24f],
    [0x300, 0x36f],
    [0x1e00, 0x1eff],
    [0x2000, 0x206f],
  ]) {
    for (let point = start; point <= end; point++) text += String.fromCodePoint(point);
  }
  const source = path.join(root, 'src');
  for (const name of (await fs.readdir(source, { recursive: true })).sort()) {
    if (/\.(?:astro|mdx?|json|ts|css)$/.test(name))
      text += await fs.readFile(path.join(source, name), 'utf8');
  }
  text += text.toUpperCase() + text.toLowerCase();
  return [...new Set(text.normalize('NFC') + text.normalize('NFD'))].sort().join('');
}

// Article-title faces need the complete Vietnamese alphabet and punctuation,
// plus every title currently in the collection. Keeping that set separate from
// body prose avoids shipping European and scholarly glyphs the title face never
// uses while leaving room for future Vietnamese titles.
export async function publicationTitleCharacters() {
  let text = '';
  for (let point = 0x20; point <= 0x7e; point++) text += String.fromCodePoint(point);
  text += '«»‘’“”…–—·•';

  const vietnameseVowels = 'aăâeêioôơuưyAĂÂEÊIOÔƠUƯY';
  const tones = ['', '\u0300', '\u0301', '\u0303', '\u0309', '\u0323'];
  for (const vowel of vietnameseVowels) {
    for (const tone of tones) text += `${vowel}${tone}`;
  }
  text += 'Đđ';

  const essays = path.join(root, 'src/content/essays');
  for (const name of (await fs.readdir(essays)).filter((name) => name.endsWith('.mdx')).sort()) {
    const source = await fs.readFile(path.join(essays, name), 'utf8');
    const title = source.match(/^title:\s*["'](.+)["']\s*$/m)?.[1];
    if (title) text += title;
  }

  text += text.toUpperCase() + text.toLowerCase();
  return [...new Set(text.normalize('NFC') + text.normalize('NFD'))].sort().join('');
}

async function emitSubset(
  {
    buffer,
    characters,
    family,
    style,
    script,
    source,
    sourceType,
    cssFamily,
    fontStyle,
    fontWeight,
    preloadRole,
  },
  css,
  inventory,
  preloads,
) {
  const supported = await fontCodePoints(buffer);
  const selected = [...characters]
    .map((character) => character.codePointAt(0))
    .filter((point, index, points) => supported.has(point) && points.indexOf(point) === index);
  if (!selected.length) return;

  const subsetCharacters = String.fromCodePoint(...selected);
  const key = createHash('sha256')
    .update(buffer)
    .update(subsetCharacters)
    .update('subset-font-2.7.0-v2')
    .digest('hex')
    .slice(0, 16);
  const filename = `${family}-${style}-${key}.woff2`;
  const destination = path.join(output, filename);
  if (!(await fs.stat(destination).catch(() => null))) {
    const subset = await subsetFont(buffer, subsetCharacters, {
      targetFormat: 'woff2',
      preserveNameIds: [0, 13, 14],
    });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, subset);
    await fs.rename(temporary, destination);
  }

  const coverage = unicodeRange(selected);
  css.push(`@font-face {
  font-family: '${cssFamily}';
  font-style: ${fontStyle};
  font-display: swap;
  font-weight: ${fontWeight};
  src: url('./fonts/${filename}') format('woff2');
  unicode-range: ${coverage};
}`);
  if (preloadRole) preloads.push({ filename, script, role: preloadRole });
  inventory.push({
    source,
    sourceType,
    output: filename,
    family,
    style,
    script,
    coverage,
    before: buffer.length,
    after: (await fs.stat(destination)).size,
  });
}

export async function generateFonts(logger = console) {
  await fs.mkdir(output, { recursive: true });
  const text = await publicationCharacters();
  const titleText = await publicationTitleCharacters();
  const points = [...text].map((letter) => letter.codePointAt(0));
  const css = [];
  const inventory = [];
  const preloads = [];
  for (const family of families) {
    const directory = path.join(root, 'node_modules/@fontsource', family);
    for (const style of styles[family]) {
      const original = await fs.readFile(path.join(directory, `${style}.css`), 'utf8');
      // Fontsource's Latin-ext ranges overlap Vietnamese (Đ, ư, ỵ, …).
      // Give complete Vietnamese coverage to its small subset first, so an
      // ordinary Vietnamese headline does not also request Latin-ext.
      const priority = [
        'latin',
        'vietnamese',
        'latin-ext',
        'greek',
        'greek-ext',
        'cyrillic',
        'cyrillic-ext',
      ];
      const faces = [...original.matchAll(/@font-face\s*\{[^}]+\}/g)]
        .map(([face]) => {
          const source = face.match(/url\(([^)]+\.woff2)\)/)[1];
          const script = source
            .replace(`./files/${family}-`, '')
            .replace(/-\d+-(normal|italic)\.woff2$/, '');
          return { face, source, script };
        })
        .sort((a, b) => priority.indexOf(a.script) - priority.indexOf(b.script));
      const assigned = new Set();
      for (const { face, source, script } of faces) {
        const range = face.match(/unicode-range:\s*([^;]+);/)[1];
        const spans = range.split(',').map((item) => {
          const [start, end = start] = item.trim().replace('U+', '').split('-');
          return [Number.parseInt(start, 16), Number.parseInt(end, 16)];
        });
        const buffer = await fs.readFile(path.join(directory, source));
        const supported = await fontCodePoints(buffer);
        const selected = points.filter(
          (point) =>
            !assigned.has(point) &&
            supported.has(point) &&
            spans.some(([start, end]) => point >= start && point <= end),
        );
        if (!selected.length) continue;
        for (const point of selected) assigned.add(point);
        const characters = String.fromCodePoint(...selected);
        const key = createHash('sha256')
          .update(buffer)
          .update(characters)
          .update('subset-font-2.7.0-v1')
          .digest('hex')
          .slice(0, 16);
        const filename = `${family}-${style}-${key}.woff2`;
        const destination = path.join(output, filename);
        if (!(await fs.stat(destination).catch(() => null))) {
          const subset = await subsetFont(buffer, characters, {
            targetFormat: 'woff2',
            preserveNameIds: [0, 13, 14],
          });
          const temporary = `${destination}.${randomUUID()}.tmp`;
          await fs.writeFile(temporary, subset);
          await fs.rename(temporary, destination);
        }
        const coverage = unicodeRange(selected);
        css.push(
          face
            .replace(/src:[^;]+;/, `src: url('./fonts/${filename}') format('woff2');`)
            .replace(/unicode-range:[^;]+;/, `unicode-range: ${coverage};`),
        );
        if (
          family === 'eb-garamond' &&
          ((style === '600' && script === 'latin') ||
            (style === '700' && ['latin', 'vietnamese'].includes(script)))
        ) {
          preloads.push({ filename, script, role: style === '600' ? 'wordmark' : 'heading' });
        }
        inventory.push({
          source: `${family}/${source}`,
          sourceType: 'fontsource',
          output: filename,
          family,
          style,
          script,
          coverage,
          before: buffer.length,
          after: (await fs.stat(destination)).size,
        });
      }
    }
  }

  for (const face of localFaces) {
    const buffer = await fs.readFile(path.join(root, face.source));
    await emitSubset(
      {
        ...face,
        buffer,
        characters: face.characters === 'titles' ? titleText : text,
        script: face.characters,
        sourceType: 'local',
      },
      css,
      inventory,
      preloads,
    );
  }
  await fs.writeFile(path.join(root, '.astro/fonts.css'), `${css.join('\n')}\n`);
  await fs.writeFile(
    path.join(root, '.astro/font-preloads.mjs'),
    preloads
      .map(({ filename }, index) => `import font${index} from './fonts/${filename}?url';`)
      .join('\n') +
      `\nexport default [${preloads.map(({ script, role }, index) => `{ href: font${index}, script: '${script}', role: '${role}' }`).join(',')}];\n`,
  );
  await fs.writeFile(
    path.join(root, '.astro/font-inventory.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  logger.info(
    `Publication fonts: ${inventory.length} WOFF2 subsets, original typefaces and OpenType features retained.`,
  );
}

export default function publicationFonts() {
  return {
    name: 'tcp-publication-fonts',
    hooks: { 'astro:config:setup': async ({ logger }) => generateFonts(logger) },
  };
}
