import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { create } from 'fontkit';
import fontverter from 'fontverter';
import { fontCodePoints } from '../scripts/font-coverage.mjs';
import { publicationCharacters, publicationTitleCharacters } from '../scripts/subset-fonts.mjs';

const root = new URL('../', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('.astro/font-inventory.json', root), 'utf8'));
const pointsIn = (range) =>
  range.split(',').flatMap((span) => {
    const [start, end = start] = span
      .replace('U+', '')
      .split('-')
      .map((hex) => parseInt(hex, 16));
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

test('font subsets claim only supported characters and never overlap within a style', async () => {
  const groups = new Map();
  for (const font of inventory) {
    const key = `${font.family}/${font.style}`;
    const assigned = groups.get(key) ?? new Set();
    const supported = await fontCodePoints(
      await readFile(new URL(`.astro/fonts/${font.output}`, root)),
    );
    for (const point of pointsIn(font.coverage)) {
      assert.ok(supported.has(point), `${font.output}: missing ${point.toString(16)}`);
      assert.ok(!assigned.has(point), `${key}: overlapping ${point.toString(16)}`);
      assigned.add(point);
    }
    groups.set(key, assigned);
  }
});

test('font repartition preserves the original publication character coverage', async () => {
  const requested = new Set(
    [...(await publicationCharacters())].map((char) => char.codePointAt(0)),
  );
  const fontsourceInventory = inventory.filter((font) => font.sourceType.startsWith('fontsource'));
  for (const key of new Set(fontsourceInventory.map((font) => `${font.family}/${font.style}`))) {
    const [family, style] = key.split('/');
    const originalCSS = await readFile(
      new URL(
        `node_modules/${style === 'wght' ? '@fontsource-variable' : '@fontsource'}/${family}/${style}.css`,
        root,
      ),
      'utf8',
    );
    const expected = new Set();
    for (const [face] of originalCSS.matchAll(/@font-face\s*\{[^}]+\}/g)) {
      const source = face.match(/url\(([^)]+\.woff2)\)/)[1];
      const supported = await fontCodePoints(
        await readFile(
          new URL(
            `node_modules/${style === 'wght' ? '@fontsource-variable' : '@fontsource'}/${family}/${source}`,
            root,
          ),
        ),
      );
      for (const point of pointsIn(face.match(/unicode-range:\s*([^;]+);/)[1])) {
        if (supported.has(point) && requested.has(point)) expected.add(point);
      }
    }
    const actual = new Set(
      fontsourceInventory
        .filter((font) => `${font.family}/${font.style}` === key)
        .flatMap((font) => pointsIn(font.coverage)),
    );
    assert.deepEqual(actual, expected, key);
    const vietnamese = inventory.find(
      (font) => `${font.family}/${font.style}` === key && font.script === 'vietnamese',
    );
    for (const character of 'ĐđĂăƯưƠơỲỳỴỵ') {
      assert.ok(
        pointsIn(vietnamese.coverage).includes(character.codePointAt(0)),
        `${key}: ${character}`,
      );
    }
  }
});

test('local title and reader subsets preserve their requested Vietnamese coverage', async () => {
  const publication = await publicationCharacters();
  const titles = await publicationTitleCharacters();
  const localInventory = inventory.filter((font) => font.sourceType === 'local');
  for (const font of localInventory) {
    const requested = font.family === 'playfair-display-sc' ? titles : publication;
    const original = await fontCodePoints(await readFile(new URL(font.source, root)));
    const expected = new Set(
      [...requested].map((char) => char.codePointAt(0)).filter((point) => original.has(point)),
    );
    const actual = new Set(pointsIn(font.coverage));
    assert.deepEqual(actual, expected, `${font.family}/${font.style}`);
    for (const character of 'ĐđĂăƯưƠơỲỳỴỵ') {
      assert.ok(actual.has(character.codePointAt(0)), `${font.family}/${font.style}: ${character}`);
    }
  }
});

test('Playfair subsets retain native small-cap features and homepage titles use their default glyphs', async () => {
  for (const font of inventory.filter((font) => font.family === 'playfair-display-sc')) {
    const subset = await readFile(new URL(`.astro/fonts/${font.output}`, root));
    const truetype = Buffer.from(await fontverter.convert(subset, 'truetype'));
    assert.ok(truetype.includes(Buffer.from('smcp')), `${font.style}: smcp`);
    assert.ok(truetype.includes(Buffer.from('c2sc')), `${font.style}: c2sc`);
  }

  const homepage = await readFile(new URL('src/components/home/HomeDiscovery.astro', root), 'utf8');
  assert.doesNotMatch(homepage, /font-variant-caps:\s*all-small-caps/);
  for (const selector of ['quote-feature__title', 'author-folio__latest-title']) {
    const rules = [...homepage.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`, 'g'))];
    const rule =
      rules.map((match) => match[1]).find((styles) => styles.includes('font-variant-caps')) ?? '';
    assert.match(rule, /font-variant-caps:\s*normal/);
    assert.match(rule, /text-transform:\s*lowercase/);
  }
});

test('published article titles use the real Playfair bold face while muted previews stay regular', async () => {
  const publishedTitles = [
    ['src/components/essay/EssayCard.astro', 'essay-card__title'],
    ['src/components/essay/EssayRow.astro', 'essay-row__title'],
    ['src/components/directory/ArticleList.astro', 'article-list__title'],
    ['src/components/search/SearchResults.astro', 'search-results :global\\(h3\\)'],
    ['src/layouts/EssayLayout.astro', 'essay__prev-next-title'],
  ];
  for (const [filename, selector] of publishedTitles) {
    const source = await readFile(new URL(filename, root), 'utf8');
    const rule = source.match(new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`))?.[1] ?? '';
    assert.match(rule, /font-weight:\s*var\(--w-bold\)/, filename);
  }

  const comingSoon = await readFile(
    new URL('src/components/essay/ComingSoonCard.astro', root),
    'utf8',
  );
  assert.match(
    comingSoon.match(/\.coming-card__title\s*\{([^}]+)\}/)?.[1] ?? '',
    /font-weight:\s*var\(--w-regular\)/,
  );

  const homepage = await readFile(new URL('src/components/home/HomeDiscovery.astro', root), 'utf8');
  for (const selector of ['quote-feature__title', 'author-folio__latest-title']) {
    const rule =
      [...homepage.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`, 'g'))]
        .map((match) => match[1])
        .find((styles) => styles.includes('font-weight')) ?? '';
    assert.match(rule, /font-weight:\s*var\(--w-regular\)/, selector);
  }
});

test('critical font preloads are page-specific and never fetch Bricolage eagerly', async () => {
  const pages = [
    {
      page: 'index.html',
      count: 1,
      include: ['playfair-display-sc-700'],
    },
    { page: 'books/index.html', count: 1, include: [] },
    { page: 'search/index.html', count: 1, include: [] },
    { page: 'essays/index.html', count: 1, include: ['playfair-display-sc-700'] },
    {
      page: 'essays/2026-09-02-hongkong-va-hoang-chi-phong/index.html',
      count: 1,
      include: ['playfair-display-sc-700'],
    },
  ];
  for (const { page, count, include } of pages) {
    const html = await readFile(new URL(`dist/${page}`, root), 'utf8');
    const preloads = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes('as="font"'));
    assert.equal(preloads.length, count, page);
    const preloadMarkup = preloads.join('\n');
    for (const familyStyle of include) assert.match(preloadMarkup, new RegExp(familyStyle), page);
    assert.doesNotMatch(preloadMarkup, /playfair-display-sc-400/, page);
    assert.doesNotMatch(preloadMarkup, /bricolage-grotesque/, page);
    for (const tag of preloads) {
      assert.match(tag, /crossorigin/);
      const href = tag.match(/href="([^"]+)"/)[1];
      assert.ok(html.includes(`url(${href})`) || html.includes(`url("${href}")`), href);
      assert.ok((await readFile(new URL(`dist${href}`, root))).length > 0, href);
    }
  }
});

test('Garamond normal subsets keep a real variable weight axis', async () => {
  for (const font of inventory.filter(
    (font) => font.family === 'eb-garamond' && font.style === 'wght',
  )) {
    const parsed = create(await readFile(new URL(`.astro/fonts/${font.output}`, root)));
    assert.equal(parsed.variationAxes.wght.min, 400);
    assert.equal(parsed.variationAxes.wght.max, 800);
  }
});
