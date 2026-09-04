import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const dist = new URL('../dist/', import.meta.url);
const html = (path) => readFileSync(new URL(path, dist), 'utf8');

test('homepage identifies the publication with one visible H1 and WebSite data in the head', () => {
  const home = html('index.html');
  assert.equal([...home.matchAll(/<h1\b/g)].length, 1);
  assert.match(home, /<h1\b[^>]*>The Cochinchine Pensées<\/h1>/);
  const head = home.split('</head>')[0];
  const data = JSON.parse(
    head.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)[1],
  );
  const website = data['@graph'].find((entry) => entry['@type'] === 'WebSite');
  assert.equal(website.name, 'The Cochinchine Pensées');
  assert.equal(website.url, 'https://cochinchinepensees.studio/');
  assert.ok(website.alternateName.includes('Cochinchine Pensees'));
  assert.match(head, /property="og:type" content="website"/);
  assert.doesNotMatch(head, /noindex/);
});

test('only articles opt into reader preferences and article Open Graph metadata', () => {
  for (const path of readdirSync(dist, { recursive: true }).filter((path) =>
    path.endsWith('.html'),
  )) {
    const page = html(path);
    const article = path.startsWith('essays/') && !/^essays\/(?:\d+\/)?index.html$/.test(path);
    const tag = page.match(/<html\b[^>]*>/)[0];
    assert.equal(tag.includes('data-reader="true"'), article, path);
    assert.match(
      page,
      new RegExp(`property="og:type" content="${article ? 'article' : 'website'}"`),
      path,
    );
  }
});

test('every page has a single self-canonical and pagination remains crawlable', () => {
  for (const path of readdirSync(dist, { recursive: true }).filter((path) =>
    path.endsWith('.html'),
  )) {
    const page = html(path);
    const canonicals = [...page.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)];
    assert.equal(canonicals.length, 1, path);
    const route =
      path === 'index.html'
        ? '/'
        : path === '404.html'
          ? '/404'
          : `/${path.replace(/\/index.html$/, '')}`;
    assert.equal(canonicals[0][1], `https://cochinchinepensees.studio${route}`, path);
    if (/^essays\/\d+\//.test(path)) {
      assert.doesNotMatch(page, /name="robots" content="noindex/);
      assert.match(page, /<h1[^>]*><a\b[^>]*href="\/essays"[^>]*>All Essays<\/a><\/h1>/);
      assert.match(
        page,
        /description" content="Kho tiểu luận The Cochinchine Pensées, trang \d+\/\d+/,
      );
    }
  }
});

test('unfinished About is noindex but discoverable, and excluded from the sitemap', () => {
  assert.match(html('about/index.html'), /name="robots" content="noindex, follow"/);
  const sitemap = html('sitemap-0.xml');
  assert.doesNotMatch(sitemap, /<loc>[^<]*\/(?:about\/?|404(?:\.html)?)<\/loc>/);
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).href);
  assert.ok(urls.includes('https://cochinchinepensees.studio/'));
  assert.match(sitemap, /<loc>https:\/\/cochinchinepensees.studio\/essays\/2<\/loc>/);
  assert.doesNotMatch(html('robots.txt'), /Disallow: \/about/);
});
