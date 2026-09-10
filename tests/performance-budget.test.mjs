import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { brotliCompressSync } from 'node:zlib';

const home = readFileSync(new URL('../dist/index.html', import.meta.url));
test('homepage stays below 200 KB raw and 30 KB Brotli without the full discovery catalog', () => {
  assert.ok(home.length < 200_000, `HTML: ${home.length} bytes`);
  assert.ok(brotliCompressSync(home).length < 30_000);
  assert.doesNotMatch(home.toString(), /data-home-discovery-payload/);
});
