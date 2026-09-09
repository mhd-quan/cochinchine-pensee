import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const script = (file) => ts.transpileModule(fs.readFileSync(new URL(`../src/components/essay/${file}`, import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1], { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function navigation() {
  const button = Object.assign(new EventTarget(), { hidden: true });
  const state = { bottom: 3000, focused: false, reduced: false, calls: [] };
  const elements = { '[data-reader-return]': button, '[data-article-end]': { getBoundingClientRect: () => ({ bottom: state.bottom }) }, '#essay-title': { focus: () => { state.focused = true; } } };
  const document = Object.assign(new EventTarget(), { querySelector: s => elements[s] });
  const window = Object.assign(new EventTarget(), { scrollY: 0, innerHeight: 800, scrollTo: options => state.calls.push(options) });
  let next = 0; const frames = new Map();
  vm.runInNewContext(script('ReaderNavigation.astro'), { document, window, ResizeObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: cb => { frames.set(++next, cb); return next; }, cancelAnimationFrame: id => frames.delete(id), matchMedia: () => ({ matches: state.reduced }) });
  const update = () => { window.dispatchEvent(new Event('scroll')); for (const [id, cb] of frames) { frames.delete(id); cb(); } };
  return { button, document, window, state, update };
}

test('return control follows the end of the article, including scrolling back up', () => {
  const h = navigation(); assert.equal(h.button.hidden, true);
  h.window.scrollY = 1000; h.state.bottom = 801; h.update(); assert.equal(h.button.hidden, true);
  h.state.bottom = 800; h.update(); assert.equal(h.button.hidden, false);
  h.state.bottom = -100; h.update(); assert.equal(h.button.hidden, false);
  h.state.bottom = 1200; h.update(); assert.equal(h.button.hidden, true);
  h.window.scrollY = 0; h.state.bottom = 600; h.update(); assert.equal(h.button.hidden, true);
});

test('return control respects reduced motion, transfers focus, and cleans up on navigation', () => {
  const h = navigation(); h.state.reduced = true;
  h.button.dispatchEvent(new Event('click'));
  assert.equal(h.state.focused, true); assert.equal(h.state.calls[0].top, 0); assert.equal(h.state.calls[0].behavior, 'instant');
  h.document.dispatchEvent(new Event('astro:before-swap'));
  h.button.dispatchEvent(new Event('click')); assert.equal(h.state.calls.length, 1);
  h.document.dispatchEvent(new Event('astro:page-load'));
  h.document.dispatchEvent(new Event('astro:page-load'));
  h.button.dispatchEvent(new Event('click')); assert.equal(h.state.calls.length, 2);
});

test('platform controls open only on activation and do not duplicate handlers after Astro navigation', () => {
  const calls = [];
  const buttons = ['https://www.facebook.com/sharer/sharer.php?u=example','https://twitter.com/intent/tweet?url=example'].map(url => Object.assign(new EventTarget(), { dataset: { readerShare: url }, disabled: true }));
  const document = Object.assign(new EventTarget(), { querySelectorAll: s => s === '[data-reader-share]' ? buttons : [] });
  vm.runInNewContext(script('ShareLinks.astro'), { document, window: { open: (...args) => calls.push(args) } });
  document.dispatchEvent(new Event('astro:page-load')); document.dispatchEvent(new Event('astro:page-load'));
  assert.equal(calls.length, 0);
  for (const button of buttons) { assert.equal(button.disabled, false); button.dispatchEvent(new Event('click')); }
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], buttons[0].dataset.readerShare);
  assert.equal(calls[1][0], buttons[1].dataset.readerShare);
  assert.equal(calls[0][2], 'noopener,noreferrer');
});
