import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { foldSearchText, vietnameseSearchAliases } from '../src/lib/searchText.ts';
import { searchPublication } from '../src/lib/searchQuery.ts';

const dist = new URL('../dist/', import.meta.url);
const html = (path) => readFileSync(new URL(path, dist), 'utf8');

test('Vietnamese normalization preserves words and supports đ plus decomposed input', () => {
  assert.equal(foldSearchText('Lời hứa Ngày Độc lập'), 'loi hua ngay doc lap');
  assert.equal(foldSearchText('ĐẶC ĐIỂM'.normalize('NFD')), 'dac diem');
  assert.equal(vietnameseSearchAliases('Độc lập, độc lập. Dân tộc và đời sống.'), 'doc doi');
});

test('search includes each published article exactly once and excludes navigation pages', () => {
  const entry = JSON.parse(html('pagefind/pagefind-entry.json'));
  const pages = readdirSync(new URL('essays/', dist), { recursive: true })
    .filter((path) => path.endsWith('.html'))
    .map((path) => html(`essays/${path}`))
    .filter((page) => page.includes('data-pagefind-body'));
  assert.equal(entry.languages.vi.page_count, pages.length);
  assert.ok(pages.length > 0);
  for (const page of pages) {
    assert.match(page, /data-search-title="[^"]+"/);
    assert.match(page, /data-search-title-alias="[^"]+"/);
    assert.match(page, /data-search-aliases(?:="[^"]*"|\s|>)/);
  }
  for (const route of [
    'index.html',
    'books/index.html',
    'archives/index.html',
    'search/index.html',
  ]) {
    assert.doesNotMatch(html(route), /data-pagefind-body/);
  }
  assert.match(html('search/index.html'), /name="robots" content="noindex, follow"/);
  assert.doesNotMatch(html('sitemap-0.xml'), /<loc>[^<]*\/search<\/loc>/);
});

test('built search ranks Vietnamese titles with or without accents and rejects unrelated words', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(readFileSync(new URL(url)));
  const engine = await import('../dist/pagefind/pagefind.js');
  try {
    await engine.options({
      baseUrl: '/',
      ranking: { metaWeights: { title: 5, title_alias: 5, aliases: 1 } },
    });
    for (const query of ['Lời hứa Ngày Độc lập', 'loi hua ngay doc lap', 'độc lập']) {
      const results = await searchPublication(engine, query);
      assert.equal((await results[0].data()).meta.title, 'Lời hứa Ngày Độc lập');
    }
    const english = await searchPublication(engine, 'Golden Age');
    assert.equal((await english[0].data()).meta.title, 'The Golden Age and Its Discontents');
    for (const query of ['', '…', 'qzxnonexistent987', 'zzzzzzxyz']) {
      assert.deepEqual(await searchPublication(engine, query), []);
    }
  } finally {
    await engine.destroy();
    globalThis.fetch = originalFetch;
  }
});

test('search stays on demand and homepage has one series track with real destinations', () => {
  const home = html('index.html');
  assert.doesNotMatch(home, /(?:src|href)="\/pagefind\//);
  assert.equal([...home.matchAll(/id="series-track"/g)].length, 1);
  assert.equal([...home.matchAll(/data-series-slide(?:\s|>)/g)].length, 4);
  assert.match(home, /Nhận thông tin bài viết mới/);
  assert.doesNotMatch(home, /Weekly essays|Receive the weekly|<iframe/);
});
