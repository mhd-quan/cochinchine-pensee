import assert from 'node:assert/strict';
import test from 'node:test';
import { cumulativeLayoutShift } from '../scripts/performance-metrics.mjs';

test('CLS uses the largest session rather than summing independent shifts', () => {
  assert.equal(cumulativeLayoutShift([]), 0);
  assert.equal(
    cumulativeLayoutShift([
      { startTime: 100, value: 0.125 },
      { startTime: 500, value: 0.125 },
      { startTime: 600, value: 0.5, hadRecentInput: true },
      { startTime: 1_500, value: 0.125 },
      { startTime: 2_000, value: 0.125 },
    ]),
    0.25,
  );
});

test('CLS closes a session at five seconds even with continuous small shifts', () => {
  assert.equal(
    cumulativeLayoutShift(
      Array.from({ length: 8 }, (_, index) => ({ startTime: index * 800, value: 0.125 })),
    ),
    0.875,
  );
});
