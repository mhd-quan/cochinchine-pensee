import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';
import {
  createHomeDiscoveryLifecycle,
  getVietnamDateKey,
  selectDailyHomeQuote,
} from '../src/lib/homeQuoteSelection.mjs';

const root = new URL('../', import.meta.url);
const quoteRecords = JSON.parse(readFileSync(new URL('src/data/home-quotes.json', root), 'utf8'));
const markdown = unified().use(remarkParse);
const EXCLUDED_QUOTE_ESSAY = '2025-04-18-thich-minh-tue-archetype-cua-self';

function normalize(value) {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function nodeText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'break') return ' ';
  return (node.children ?? []).map(nodeText).join('');
}

function essayRecords() {
  return readdirSync(new URL('src/content/essays/', root))
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => {
      const source = readFileSync(new URL(`src/content/essays/${filename}`, root), 'utf8');
      const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      assert.ok(match, filename);
      const data = parseYaml(match[1]);
      const tree = markdown.parse(source.slice(match[0].length));
      const paragraphs = [];
      const visit = (node) => {
        if (node.type === 'paragraph') paragraphs.push(normalize(nodeText(node)));
        else for (const child of node.children ?? []) visit(child);
      };
      visit(tree);
      return {
        id: filename.replace(/\.mdx$/, ''),
        data,
        paragraphs,
      };
    });
}

test('every quote-eligible essay has exactly two distinct, contiguous source quotations', () => {
  const essays = essayRecords();
  const published = essays.filter(({ data }) => !data.draft && !data.comingSoon);
  const publishedIds = published.map(({ id }) => id).sort();
  const eligibleIds = publishedIds.filter((id) => id !== EXCLUDED_QUOTE_ESSAY);
  const quotedIds = quoteRecords.map(({ essayId }) => essayId).sort();
  assert.ok(publishedIds.includes(EXCLUDED_QUOTE_ESSAY));
  assert.ok(published.some(({ id }) => id === EXCLUDED_QUOTE_ESSAY));
  assert.deepEqual(quotedIds, eligibleIds);
  assert.equal(quoteRecords.length, 57);
  assert.equal(new Set(quotedIds).size, quotedIds.length);

  const allQuotes = new Set();
  for (const record of quoteRecords) {
    const essay = published.find(({ id }) => id === record.essayId);
    assert.ok(essay, record.essayId);
    assert.equal(record.quotes.length, 2, record.essayId);
    assert.ok(essay.data.coverImage ?? essay.data.cover_image, record.essayId);
    for (const quote of record.quotes) {
      const normalized = normalize(quote);
      assert.equal(quote, normalized, `${record.essayId}: quote normalization`);
      assert.ok(
        normalized.length >= 100 && normalized.length <= 420,
        `${record.essayId}: ${normalized.length} chars`,
      );
      assert.ok(
        essay.paragraphs.some((paragraph) => paragraph.includes(normalized)),
        `${record.essayId}: quote is not a contiguous rendered paragraph excerpt`,
      );
      assert.ok(!allQuotes.has(normalized), `${record.essayId}: duplicate quote`);
      allQuotes.add(normalized);
    }
  }
  assert.equal(allQuotes.size, 114);
});

test('the Vietnam calendar selects one shared quote and advances article before quote pass', () => {
  const choices = [
    { quoteKey: 'a:0', essayId: 'a' },
    { quoteKey: 'a:1', essayId: 'a' },
    { quoteKey: 'b:0', essayId: 'b' },
    { quoteKey: 'b:1', essayId: 'b' },
  ];
  assert.equal(getVietnamDateKey(new Date('2026-09-07T16:59:59.999Z')), '2026-09-07');
  assert.equal(getVietnamDateKey(new Date('2026-09-07T17:00:00.000Z')), '2026-09-08');
  assert.equal(selectDailyHomeQuote(choices, '2026-01-01').quoteKey, 'a:0');
  assert.equal(selectDailyHomeQuote(choices, '2026-01-02').quoteKey, 'b:0');
  assert.equal(selectDailyHomeQuote(choices, '2026-01-03').quoteKey, 'a:1');
  assert.equal(selectDailyHomeQuote(choices, '2026-01-04').quoteKey, 'b:1');
  assert.equal(selectDailyHomeQuote(choices, '2026-01-05').quoteKey, 'a:0');
  assert.throws(() => selectDailyHomeQuote(choices, '2026-02-30'), /Invalid Vietnam/);
});

test('all 114 excerpts appear once per cycle without consecutive articles', () => {
  const choices = quoteRecords.flatMap(({ essayId, quotes }) =>
    quotes.map((quote, index) => ({ essayId, quote, quoteKey: `${essayId}:${index}` })),
  );
  const start = Date.UTC(2026, 0, 1);
  const selections = Array.from({ length: choices.length }, (_, offset) => {
    const dateKey = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
    return selectDailyHomeQuote(choices, dateKey);
  });
  assert.equal(new Set(selections.map(({ quoteKey }) => quoteKey)).size, 114);
  for (let index = 1; index < selections.length; index += 1) {
    assert.notEqual(selections[index].essayId, selections[index - 1].essayId);
  }
});

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.hidden = true;
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

class FakeDocument extends EventTarget {
  constructor(container) {
    super();
    this.container = container;
    this.visibilityState = 'visible';
  }

  querySelector(selector) {
    return selector === '[data-home-discovery]' ? this.container : undefined;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function fakeContainer(payload) {
  const elements = new Map([
    ['[data-home-discovery-payload]', new FakeElement('script')],
    ['[data-home-discovery-active]', new FakeElement()],
    ['[data-home-discovery-link]', new FakeElement('a')],
    ['[data-home-discovery-blockquote]', new FakeElement('blockquote')],
    ['[data-home-discovery-quote]', new FakeElement('p')],
    ['[data-home-discovery-title]', new FakeElement('p')],
    ['[data-home-discovery-author]', new FakeElement('span')],
    ['[data-home-discovery-image]', new FakeElement('figure')],
  ]);
  elements.get('[data-home-discovery-payload]').textContent = JSON.stringify(payload);
  return {
    dataset: {},
    elements,
    querySelector(selector) {
      return elements.get(selector);
    },
  };
}

const image = (name) => ({
  alt: `${name} cover`,
  avif: { type: 'image/avif', srcset: `${name}.avif 160w`, sizes: '160px' },
  fallback: {
    src: `${name}.webp`,
    srcset: `${name}.webp 160w`,
    sizes: '160px',
    width: 160,
    height: 90,
  },
});
const lifecyclePayload = {
  articles: {
    a: {
      href: '/essays/a',
      title: 'Essay A',
      author: 'Author A',
      lang: 'vi',
      coverTreatment: 'paper',
      image: image('a'),
    },
    b: {
      href: '/essays/b',
      title: 'Essay B',
      author: 'Author B',
      lang: 'en',
      coverTreatment: 'plate',
      image: image('b'),
    },
  },
  choices: [
    { quoteKey: 'a:0', essayId: 'a', quote: 'Quote A0' },
    { quoteKey: 'a:1', essayId: 'a', quote: 'Quote A1' },
    { quoteKey: 'b:0', essayId: 'b', quote: 'Quote B0' },
    { quoteKey: 'b:1', essayId: 'b', quote: 'Quote B1' },
  ],
};

function assertSelection(container, expected, quoteKey) {
  const get = (selector) => container.elements.get(selector);
  assert.equal(container.dataset.essayId, expected);
  assert.equal(container.dataset.quoteKey, quoteKey);
  assert.equal(get('[data-home-discovery-link]').href, `/essays/${expected}`);
  assert.equal(get('[data-home-discovery-blockquote]').cite, `/essays/${expected}`);
  assert.equal(get('[data-home-discovery-title]').textContent, `Essay ${expected.toUpperCase()}`);
  assert.equal(get('[data-home-discovery-author]').textContent, `Author ${expected.toUpperCase()}`);
  assert.equal(
    get('[data-home-discovery-quote]').textContent,
    `Quote ${quoteKey.replace(':', '').toUpperCase()}`,
  );
  assert.equal(get('[data-home-discovery-quote]').lang, expected === 'a' ? 'vi' : 'en');
  assert.equal(
    get('[data-home-discovery-image]').dataset.coverTreatment,
    expected === 'a' ? 'paper' : 'plate',
  );
  const picture = get('[data-home-discovery-image]').children[0];
  assert.equal(picture.tagName, 'picture');
  assert.equal(picture.children[1].src, `${expected}.webp`);
}

test('direct, reload, Astro Back and BFCache keep the shared quote until Vietnam midnight', () => {
  let instant = new Date('2026-01-01T12:00:00Z');
  const now = () => instant;
  const first = fakeContainer(lifecyclePayload);
  const document = new FakeDocument(first);
  const window = new EventTarget();
  createHomeDiscoveryLifecycle({ document, window, now });
  assertSelection(first, 'a', 'a:0');

  document.dispatchEvent(new Event('astro:page-load'));
  assertSelection(first, 'a', 'a:0');

  document.container = undefined;
  document.dispatchEvent(new Event('astro:page-load'));

  const back = fakeContainer(lifecyclePayload);
  document.container = back;
  document.dispatchEvent(new Event('astro:page-load'));
  assertSelection(back, 'a', 'a:0');

  const restored = new Event('pageshow');
  Object.defineProperty(restored, 'persisted', { value: true });
  window.dispatchEvent(restored);
  assertSelection(back, 'a', 'a:0');

  instant = new Date('2026-01-01T17:00:00Z');
  window.dispatchEvent(new Event('focus'));
  assertSelection(back, 'b', 'b:0');

  window.dispatchEvent(restored);
  assertSelection(back, 'b', 'b:0');

  instant = new Date('2026-01-02T17:00:00Z');
  document.dispatchEvent(new Event('visibilitychange'));
  assertSelection(back, 'a', 'a:1');
});

test('separate visitors and reloads use the same quote without randomness or storage', () => {
  const instant = new Date('2026-01-04T04:00:00Z');
  const first = fakeContainer(lifecyclePayload);
  createHomeDiscoveryLifecycle({
    document: new FakeDocument(first),
    window: new EventTarget(),
    now: () => instant,
  });
  assertSelection(first, 'b', 'b:1');

  const secondVisitor = fakeContainer(lifecyclePayload);
  createHomeDiscoveryLifecycle({
    document: new FakeDocument(secondVisitor),
    window: new EventTarget(),
    now: () => new Date('2026-01-04T22:00:00+07:00'),
  });
  assertSelection(secondVisitor, 'b', 'b:1');

  const source = readFileSync(new URL('src/lib/homeQuoteSelection.mjs', root), 'utf8');
  assert.doesNotMatch(source, /Math\.random|sessionStorage|localStorage/);
  const reload = fakeContainer(lifecyclePayload);
  createHomeDiscoveryLifecycle({
    document: new FakeDocument(reload),
    window: new EventTarget(),
    now: () => instant,
  });
  assertSelection(reload, 'b', 'b:1');
});

test('built homepage keeps the payload out of the rendered quote DOM and offers a no-script picture', () => {
  const home = readFileSync(new URL('dist/index.html', root), 'utf8');
  const module = home.match(/<section\b[^>]*data-home-discovery[\s\S]*?<\/section>/)?.[0];
  assert.ok(module);
  const active = module.match(/data-home-discovery-active[^>]*>([\s\S]*?)<noscript>/)?.[1];
  assert.ok(active);
  assert.doesNotMatch(active, /<img\b/);
  assert.match(module, /<noscript>[\s\S]*?<picture\b[\s\S]*?<img\b/);
  assert.equal([...module.matchAll(/data-home-discovery-payload/g)].length, 1);
  assert.doesNotMatch(
    module.match(/data-home-discovery-payload[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '',
    /[<&]/,
  );
});
