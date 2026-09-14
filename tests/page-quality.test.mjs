import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import sharp from 'sharp';
import { attr, findAll, textContent } from '../scripts/html-document.mjs';

const dist = new URL('../dist/', import.meta.url);
const pages = readdirSync(dist, { recursive: true }).filter((path) => path.endsWith('.html'));

test('all pages have unique metadata and locally available share images and icons', async () => {
  const titles = new Set();
  const descriptions = new Set();
  const images = new Set();
  for (const path of pages) {
    const document = parse(readFileSync(new URL(path, dist), 'utf8'));
    const nodes = findAll(document, (node) => ['title', 'meta', 'link'].includes(node.tagName));
    const title = nodes.filter((node) => node.tagName === 'title');
    assert.equal(title.length, 1, path);
    const titleText = textContent(title[0]).trim();
    assert.ok(titleText && !titles.has(titleText), `Missing/duplicate title: ${path}`);
    titles.add(titleText);
    const meta = (key) =>
      nodes.filter((node) => attr(node, 'name') === key || attr(node, 'property') === key);
    const description = meta('description');
    assert.equal(description.length, 1, path);
    const copy = attr(description[0], 'content')?.trim();
    assert.ok(copy && !descriptions.has(copy), `Missing/duplicate description: ${path}`);
    descriptions.add(copy);
    assert.equal(attr(meta('og:title')[0], 'content'), titleText, path);
    assert.equal(attr(meta('og:description')[0], 'content'), copy, path);
    assert.equal(meta('og:image').length, 1, path);
    const image = new URL(attr(meta('og:image')[0], 'content'));
    assert.equal(image.origin, 'https://cochinchinepensees.studio');
    assert.equal(attr(meta('twitter:image')[0], 'content'), image.href, path);
    assert.ok(attr(meta('og:image:alt')[0], 'content')?.trim(), `Missing OG alt: ${path}`);
    images.add(image.pathname);
    for (const rel of ['icon', 'apple-touch-icon']) {
      const icon = nodes.find((node) => attr(node, 'rel') === rel);
      const url = new URL(attr(icon, 'href'), image.origin);
      assert.ok(existsSync(new URL(`.${url.pathname}`, dist)), `Missing ${rel}: ${path}`);
    }
  }
  for (const path of images) {
    const metadata = await sharp(fileURLToPath(new URL(`.${path}`, dist))).metadata();
    assert.ok(metadata.width > 0 && metadata.height > 0, path);
  }
  const shared = await sharp(fileURLToPath(new URL('og-default.png', dist))).metadata();
  assert.equal(shared.width, 1200);
  assert.equal(shared.height, 630);
});

test('rendered images have explicit alt, dimensions and responsive candidates', () => {
  for (const path of pages) {
    const document = parse(readFileSync(new URL(path, dist), 'utf8'));
    for (const image of findAll(document, (node) => node.tagName === 'img')) {
      assert.notEqual(attr(image, 'alt'), undefined, `Missing alt: ${path}`);
      assert.ok(Number(attr(image, 'width')) > 0 && Number(attr(image, 'height')) > 0, path);
      assert.ok(attr(image, 'srcset') && attr(image, 'sizes'), `Missing responsive image: ${path}`);
      const src = attr(image, 'src');
      assert.ok(src.startsWith('/images/responsive/'), `${path}: ${src}`);
      assert.ok(existsSync(new URL(`.${src}`, dist)), `${path}: ${src}`);
    }
  }
});
