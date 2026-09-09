import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'parse5';
import { canonicalUrl, serializeJsonLd } from '../src/lib/seo/publication.mjs';
import { shareTargets } from '../src/lib/share.mjs';
import { validateEditorialSeo } from '../scripts/seo-review.mjs';
import { readArticle, findAll, attr, textContent, articleBlocks } from '../scripts/html-document.mjs';

const dist = new URL('../dist/', import.meta.url);
const profiles = JSON.parse(fs.readFileSync(new URL('../editorial/essay-seo.json', import.meta.url)));

test('every published source has current, unique editorial metadata', async () => {
  const result = await validateEditorialSeo();
  assert.ok(result.count > 0);
  assert.deepEqual(result.errors, []);
});

test('canonical URLs discard tracking, anchors and alternate index spelling', () => {
  assert.equal(canonicalUrl('/essays/example/index.html?utm_source=x#note'), 'https://cochinchinepensees.studio/essays/example');
  assert.equal(canonicalUrl('/'), 'https://cochinchinepensees.studio/');
  assert.throws(() => canonicalUrl('https://example.com/'));
  assert.ok(!serializeJsonLd({ title: '</script><script>bad' }).includes('<'));
});

test('sharing preserves Vietnamese, punctuation and the canonical article URL', () => {
  const title = 'Gởi thơ: “Chúng ta & họ?” #1';
  const url = canonicalUrl('/essays/example');
  const targets = shareTargets(title, url);
  assert.equal(new URL(targets.facebook).searchParams.get('u'), url);
  assert.equal(new URL(targets.x).searchParams.get('text'), title);
  assert.equal(new URL(targets.x).searchParams.get('url'), url);
  const email = new URL(targets.email);
  assert.equal(email.protocol, 'mailto:');
  assert.equal(email.searchParams.get('subject'), title);
  assert.equal(email.searchParams.get('body'), `${title}\n\n${url}`);
});

test('rendered essays have truthful identity, consistent metadata, discovery and downloads', () => {
  const sitemap = fs.readFileSync(new URL('sitemap-0.xml', dist), 'utf8');
  const feed = JSON.parse(fs.readFileSync(new URL('feed.json', dist)));
  for (const [slug, profile] of Object.entries(profiles)) {
    const html = fs.readFileSync(new URL(`essays/${slug}/index.html`, dist), 'utf8');
    const article = readArticle(html);
    const metadata = findAll(article.document, n => n.tagName === 'meta');
    const meta = (key) => metadata.filter(n => attr(n,'name') === key || attr(n,'property') === key).map(n=>attr(n,'content'));
    assert.deepEqual(meta('description'), [profile.description], slug);
    assert.deepEqual(meta('og:description'), [profile.description], slug);
    assert.deepEqual(meta('og:url'), [article.canonical], slug);
    assert.ok(!meta('robots').join().includes('noindex'), slug);
    assert.ok(!meta('keywords').length, slug);
    const graphs = findAll(article.document, n => n.tagName === 'script' && attr(n,'type') === 'application/ld+json').flatMap(n=>JSON.parse(textContent(n))['@graph'] ?? []);
    const entities = graphs.filter(n => n['@type'] === 'Article');
    assert.equal(entities.length, 1, slug);
    const entity = entities[0];
    assert.equal(entity.headline, article.title, slug);
    assert.equal(entity.description, profile.description, slug);
    assert.equal(entity.author.name, article.author, slug);
    assert.equal(entity.url, article.canonical, slug);
    assert.equal(Date.parse(entity.datePublished), Date.parse(article.date), slug);
    assert.equal(entity.dateModified, profile.contentModifiedAt, slug);
    assert.ok(fs.existsSync(new URL(`${new URL(entity.author.url).pathname.slice(1)}/index.html`, dist)), slug);
    for (const image of entity.image ?? []) assert.ok(fs.existsSync(new URL(new URL(image).pathname.slice(1), dist)), `${slug}: image`);
    assert.ok(sitemap.includes(`<loc>${article.canonical}</loc><lastmod>`), slug);
    assert.ok(!sitemap.includes('/downloads/'), slug);
    const item = feed.items.find(item => item.url === article.canonical);
    assert.ok(item, `${slug}: feed`);
    assert.ok(html.includes(`data-copy-url="${article.canonical}"`), slug);
    const pdf = findAll(article.document, n => n.tagName === 'a').find(n => attr(n,'href') === `/downloads/essays/${slug}.pdf`);
    assert.ok(pdf, `${slug}: PDF link`);
    assert.equal(attr(pdf,'data-astro-prefetch'), 'false');
    assert.ok(fs.existsSync(new URL(`downloads/essays/${slug}.pdf`,dist)), `${slug}: generated PDF`);
    assert.ok(html.includes('Gởi thơ đến chúng tôi'), slug);
  }
});

test('PDF extraction preserves list labels, emphasis, images and footnote text', () => {
  const doc = parse('<article><ol><li><p>First <em>word</em></p></li><li><p>Second</p></li></ol><p>Note<sup>1</sup></p><figure><img src="/images/a.webp"><figcaption>Caption</figcaption></figure><section><ol><li><p>Footnote <a href="#fnref-1">↩</a></p></li></ol></section></article>');
  const blocks = articleBlocks(doc);
  const text = blocks.filter(b=>b.type === 'text').map(b=>b.runs.map(r=>r.text).join(''));
  assert.deepEqual(text, ['1. First word', '2. Second', 'Note1', 'Caption', '1. Footnote ']);
  assert.ok(blocks.find(b=>b.type === 'image' && b.src === '/images/a.webp'));
  assert.ok(blocks.some(b=>b.runs?.some(r=>r.italic && r.text === 'word')));
});
