import assert from 'node:assert/strict';
import test from 'node:test';
import { installGoogleAnalytics } from '../src/lib/googleAnalytics.mjs';

class FakeScript extends EventTarget {
  async = false;
  src = '';
}

class FakeDocument extends EventTarget {
  constructor() {
    super();
    this.title = 'Initial page';
    this.referrer = 'https://example.org/referrer';
    this.visibilityState = 'visible';
    this.scripts = [];
    this.head = {
      append: (script) => this.scripts.push(script),
    };
  }

  createElement(tagName) {
    assert.equal(tagName, 'script');
    return new FakeScript();
  }
}

class FakeWindow extends EventTarget {
  constructor() {
    super();
    this.location = { href: 'https://example.org/' };
    this.frames = new Map();
    this.idles = new Map();
    this.timers = new Map();
    this.nextId = 1;
    this.requestAnimationFrame = (callback) => this.#add(this.frames, callback);
    this.cancelAnimationFrame = (id) => this.frames.delete(id);
    this.requestIdleCallback = (callback, options) =>
      this.#add(this.idles, () => callback(), options);
    this.cancelIdleCallback = (id) => this.idles.delete(id);
    this.setTimeout = (callback) => this.#add(this.timers, callback);
    this.clearTimeout = (id) => this.timers.delete(id);
  }

  #add(queue, callback, options) {
    const id = this.nextId++;
    queue.set(id, { callback, options });
    return id;
  }

  runNext(queue) {
    const entry = queue.entries().next().value;
    assert.ok(entry, 'Expected a scheduled callback');
    const [id, task] = entry;
    queue.delete(id);
    task.callback();
    return task;
  }
}

function calls(window) {
  return window.dataLayer.map((entry) => Array.from(entry));
}

test('queues the initial visit immediately and loads gtag after paint and bounded idle time', () => {
  const document = new FakeDocument();
  const window = new FakeWindow();

  const first = installGoogleAnalytics({
    document,
    window,
    measurementId: 'G-TEST',
  });
  const second = installGoogleAnalytics({
    document,
    window,
    measurementId: 'G-TEST',
  });

  assert.equal(first, second);
  assert.equal(calls(window).length, 2);
  assert.equal(calls(window)[0][0], 'js');
  assert.deepEqual(calls(window)[1], [
    'config',
    'G-TEST',
    {
      page_location: 'https://example.org/',
      page_title: 'Initial page',
      page_referrer: 'https://example.org/referrer',
    },
  ]);
  assert.equal(document.scripts.length, 0);

  window.runNext(window.frames);
  window.runNext(window.frames);
  const idle = window.runNext(window.idles);
  assert.equal(idle.options.timeout, 2_000);
  assert.equal(document.scripts.length, 1);
  assert.equal(document.scripts[0].async, true);
  assert.equal(document.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST');

  document.scripts[0].dispatchEvent(new Event('load'));
  assert.equal(first.loaded, true);
});

test('a quick Astro navigation retains both URLs without duplicate configuration', () => {
  const document = new FakeDocument();
  const window = new FakeWindow();
  installGoogleAnalytics({ document, window, measurementId: 'G-TEST' });

  window.runNext(window.frames);
  document.dispatchEvent(new Event('astro:before-preparation'));
  assert.equal(window.frames.size, 0);
  assert.equal(window.idles.size, 0);
  assert.equal(window.timers.size, 1);

  window.location.href = 'https://example.org/next';
  document.title = 'Next page';
  document.dispatchEvent(new Event('astro:page-load'));

  assert.deepEqual(calls(window).slice(1), [
    [
      'config',
      'G-TEST',
      {
        page_location: 'https://example.org/',
        page_title: 'Initial page',
        page_referrer: 'https://example.org/referrer',
      },
    ],
    [
      'event',
      'page_view',
      {
        page_location: 'https://example.org/next',
        page_title: 'Next page',
        page_referrer: 'https://example.org/',
      },
    ],
  ]);
  assert.equal(document.scripts.length, 1);
  document.dispatchEvent(new Event('astro:page-load'));
  assert.equal(calls(window).length, 3);
  assert.equal(document.scripts.length, 1);
});

test('a cancelled Astro navigation and an initially hidden page still load within the bound', () => {
  const cancelledDocument = new FakeDocument();
  const cancelledWindow = new FakeWindow();
  installGoogleAnalytics({
    document: cancelledDocument,
    window: cancelledWindow,
    measurementId: 'G-TEST',
  });
  cancelledDocument.dispatchEvent(new Event('astro:before-preparation'));
  cancelledWindow.runNext(cancelledWindow.timers);
  assert.equal(cancelledDocument.scripts.length, 1);

  const hiddenDocument = new FakeDocument();
  hiddenDocument.visibilityState = 'hidden';
  const hiddenWindow = new FakeWindow();
  installGoogleAnalytics({
    document: hiddenDocument,
    window: hiddenWindow,
    measurementId: 'G-TEST',
  });
  assert.equal(hiddenDocument.scripts.length, 1);
  assert.equal(hiddenWindow.frames.size, 0);
});

test('navigation during the gtag download queues every visit until analytics takes over', () => {
  const document = new FakeDocument();
  const window = new FakeWindow();
  installGoogleAnalytics({ document, window, measurementId: 'G-TEST' });
  window.runNext(window.frames);
  window.runNext(window.frames);
  window.runNext(window.idles);

  const navigate = (path) => {
    document.dispatchEvent(new Event('astro:before-preparation'));
    window.location.href = `https://example.org/${path}`;
    document.title = path;
    document.dispatchEvent(new Event('astro:page-load'));
  };
  navigate('second');
  navigate('third');
  document.dispatchEvent(new Event('astro:page-load'));
  const visits = calls(window).filter(([command]) => command === 'event');
  assert.deepEqual(
    visits.map(([, , fields]) => fields.page_location),
    ['https://example.org/second', 'https://example.org/third'],
  );
  assert.deepEqual(
    visits.map(([, , fields]) => fields.page_referrer),
    ['https://example.org/', 'https://example.org/second'],
  );
  assert.equal(document.scripts.length, 1);
  document.scripts[0].dispatchEvent(new Event('load'));
  navigate('fourth');
  assert.equal(calls(window).filter(([command]) => command === 'event').length, 2);
});

test('uses a timer fallback and requests gtag when a passive page becomes hidden', () => {
  const document = new FakeDocument();
  const window = new FakeWindow();
  window.requestIdleCallback = undefined;
  window.cancelIdleCallback = undefined;
  installGoogleAnalytics({ document, window, measurementId: 'G-TEST' });

  window.runNext(window.frames);
  window.runNext(window.frames);
  assert.equal(window.timers.size, 1);
  assert.equal(document.scripts.length, 0);

  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(window.timers.size, 0);
  assert.equal(document.scripts.length, 1);
});
