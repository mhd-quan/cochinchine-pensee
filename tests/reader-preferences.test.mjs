import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const component = readFileSync(
  new URL('../src/components/essay/ReaderPreferences.astro', import.meta.url),
  'utf8',
);
const script = component.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
const savedReader = JSON.stringify({
  theme: 'night',
  font: 'garamond',
  fontSize: 'xl',
  measure: 'wide',
});

class Page extends EventTarget {
  constructor(reader = false) {
    super();
    this.documentElement = {
      dataset: reader ? { reader: 'true', theme: 'paper' } : { theme: 'paper' },
      classList: new Set(),
    };
    this.documentElement.classList.remove = this.documentElement.classList.delete;
    this.meta = {
      content: '#EEEEEB',
      setAttribute(key, value) {
        this[key] = value;
      },
    };
  }
  querySelector() {
    return this.meta;
  }
}

function harness(reader, saved = savedReader) {
  const document = new Page(reader);
  const window = new EventTarget();
  const storage = { value: saved };
  const context = vm.createContext({
    document,
    window,
    localStorage: {
      getItem() {
        if (storage.value instanceof Error) throw storage.value;
        return storage.value;
      },
    },
  });
  vm.runInContext(script, context);
  return { document, window, storage, context };
}

function swap(document, incoming) {
  const event = new Event('astro:before-swap');
  event.newDocument = incoming;
  document.dispatchEvent(event);
  document.documentElement = incoming.documentElement;
  document.meta = incoming.meta;
  document.dispatchEvent(new Event('astro:after-swap'));
}

test('a direct navigation page stays Paper without erasing saved reader preferences', () => {
  const { document, storage } = harness(false);
  assert.deepEqual(document.documentElement.dataset, { theme: 'paper' });
  assert.equal(document.meta.content, '#EEEEEB');
  assert.equal(storage.value, savedReader);
});

test('a direct article restores all valid reader preferences before paint', () => {
  const { document } = harness(true);
  assert.deepEqual(document.documentElement.dataset, {
    reader: 'true',
    theme: 'night',
    font: 'garamond',
    fontSize: 'xl',
    measure: 'wide',
  });
  assert.equal(document.meta.content, '#1D1A18');
});

test('Astro Back/Forward swaps apply the destination theme before swapping', () => {
  const { document, storage } = harness(true);
  const home = new Page();
  swap(document, home);
  assert.deepEqual(home.documentElement.dataset, { theme: 'paper' });
  assert.equal(home.meta.content, '#EEEEEB');
  const article = new Page(true);
  swap(document, article);
  assert.equal(article.documentElement.dataset.theme, 'night');
  assert.equal(article.meta.content, '#1D1A18');
  storage.value = JSON.stringify({ theme: 'sepia' });
  const nextArticle = new Page(true);
  swap(document, nextArticle);
  assert.equal(nextArticle.documentElement.dataset.theme, 'sepia');
  assert.equal(nextArticle.meta.content, '#ECE6D8');
});

test('pageshow clears stale reading state on a restored navigation page', () => {
  const { document, window } = harness(false);
  Object.assign(document.documentElement.dataset, {
    theme: 'night',
    font: 'garamond',
    fontSize: 'xl',
    measure: 'wide',
  });
  document.documentElement.classList.add('has-reader-panel-open');
  document.meta.content = '#1D1A18';
  window.dispatchEvent(new Event('pageshow'));
  assert.deepEqual(document.documentElement.dataset, { theme: 'paper' });
  assert.equal(document.documentElement.classList.has('has-reader-panel-open'), false);
  assert.equal(document.meta.content, '#EEEEEB');
});

test('pageshow refreshes a restored article from the latest saved preference', () => {
  const { document, window, storage } = harness(true);
  storage.value = JSON.stringify({ theme: 'sepia' });
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(document.documentElement.dataset.theme, 'sepia');
  assert.equal(document.meta.content, '#ECE6D8');
});

test('malformed, null, unsupported and blocked storage safely use reader defaults', () => {
  for (const saved of [
    'invalid',
    'null',
    '[]',
    '{"theme":"invalid","fontSize":"huge"}',
    new Error('blocked'),
  ]) {
    const { document } = harness(true, saved);
    assert.deepEqual(document.documentElement.dataset, {
      reader: 'true',
      theme: 'paper',
      font: 'serif',
      fontSize: 'md',
      measure: 'standard',
    });
    assert.equal(document.meta.content, '#EEEEEB');
  }
});

test('rerunning the inline script does not register duplicate lifecycle listeners', () => {
  const { document, window, context } = harness(true);
  let extraListeners = 0;
  document.addEventListener = window.addEventListener = () => {
    extraListeners += 1;
  };
  vm.runInContext(script, context);
  assert.equal(extraListeners, 0);
});
