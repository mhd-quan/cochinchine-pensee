import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fontCodePoints } from '../scripts/font-coverage.mjs';
import { publicationCharacters } from '../scripts/subset-fonts.mjs';

const root = new URL('../', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('.astro/font-inventory.json', root), 'utf8'));
const pointsIn = (range) => range.split(',').flatMap((span) => {
  const [start, end = start] = span.replace('U+', '').split('-').map((hex) => parseInt(hex, 16));
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});

test('font subsets claim only supported characters and never overlap within a style', async () => {
  const groups = new Map();
  for (const font of inventory) {
    const key = `${font.family}/${font.style}`;
    const assigned = groups.get(key) ?? new Set();
    const supported = await fontCodePoints(await readFile(new URL(`.astro/fonts/${font.output}`, root)));
    for (const point of pointsIn(font.coverage)) {
      assert.ok(supported.has(point), `${font.output}: missing ${point.toString(16)}`);
      assert.ok(!assigned.has(point), `${key}: overlapping ${point.toString(16)}`);
      assigned.add(point);
    }
    groups.set(key, assigned);
  }
});

test('font repartition preserves the original publication character coverage', async () => {
  const requested = new Set([...(await publicationCharacters())].map((char) => char.codePointAt(0)));
  for (const key of new Set(inventory.map((font) => `${font.family}/${font.style}`))) {
    const [family, style] = key.split('/');
    const originalCSS = await readFile(new URL(`node_modules/@fontsource/${family}/${style}.css`, root), 'utf8');
    const expected = new Set();
    for (const [face] of originalCSS.matchAll(/@font-face\s*\{[^}]+\}/g)) {
      const source = face.match(/url\(([^)]+\.woff2)\)/)[1];
      const supported = await fontCodePoints(await readFile(new URL(`node_modules/@fontsource/${family}/${source}`, root)));
      for (const point of pointsIn(face.match(/unicode-range:\s*([^;]+);/)[1])) {
        if (supported.has(point) && requested.has(point)) expected.add(point);
      }
    }
    const actual = new Set(inventory.filter((font) => `${font.family}/${font.style}` === key)
      .flatMap((font) => pointsIn(font.coverage)));
    assert.deepEqual(actual, expected, key);
    const vietnamese = inventory.find((font) => `${font.family}/${font.style}` === key && font.script === 'vietnamese');
    for (const character of 'ĐđĂăƯưƠơỲỳỴỵ') {
      assert.ok(pointsIn(vietnamese.coverage).includes(character.codePointAt(0)), `${key}: ${character}`);
    }
  }
});

test('critical font preloads reuse the exact cacheable CSS assets', async () => {
  for (const page of ['index.html', 'books/index.html', 'search/index.html', 'essays/2026-09-02-hongkong-va-hoang-chi-phong/index.html']) {
    const html = await readFile(new URL(`dist/${page}`, root), 'utf8');
    const preloads = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)]
      .map(([tag]) => tag).filter((tag) => tag.includes('as="font"'));
    assert.equal(preloads.length, page.startsWith('search/') ? 1 : page.startsWith('books/') ? 2 : 3);
    for (const tag of preloads) {
      assert.match(tag, /crossorigin/);
      const href = tag.match(/href="([^"]+)"/)[1];
      assert.ok(html.includes(`url(${href})`) || html.includes(`url("${href}")`), href);
      assert.ok((await readFile(new URL(`dist${href}`, root))).length > 0, href);
    }
  }
});
