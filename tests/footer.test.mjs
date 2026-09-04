import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const dist = new URL('../dist/', import.meta.url);
const html = (path) => readFileSync(new URL(path, dist), 'utf8');

// Footer destinations used to include routes that did not exist. Check the
// rendered links, including fragment targets in the new directory pages.
test('footer and directory navigation resolve to deployed pages and anchors', () => {
  const footer = html('index.html').match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)[1];
  const sources = [
    footer,
    ...['archives', 'authors', 'pensees', 'masthead', 'about'].map((route) =>
      html(`${route}/index.html`),
    ),
  ];
  for (const source of sources) {
    for (const [, href] of source.matchAll(/<a\b[^>]*href="([^"\s]+)"/g)) {
      if (!href.startsWith('/') && !href.startsWith('#')) continue;
      // Same-page anchors are checked separately with their owning document.
      if (href.startsWith('#')) {
        assert.ok(source.includes(`id="${decodeURIComponent(href.slice(1))}"`), href);
        continue;
      }
      const url = new URL(href, 'https://cochinchinepensees.studio');
      const path = url.pathname.replace(/^\//, '');
      const file = /\.[a-z]+$/i.test(path) ? path : `${path ? `${path}/` : ''}index.html`;
      assert.ok(existsSync(new URL(file, dist)), `Missing destination: ${href}`);
      if (url.hash)
        assert.ok(html(file).includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), href);
    }
  }
  assert.doesNotMatch(footer, /<iframe\b/);
  assert.match(footer, /href="https:\/\/archyatt\.substack\.com\/subscribe"/);
});
