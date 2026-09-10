/** CLS is the largest session: gaps < 1 s, duration < 5 s (web.dev/articles/cls). */
export function cumulativeLayoutShift(entries) {
  let maximum = 0;
  let value = 0;
  let start = 0;
  let last = 0;
  for (const entry of entries) {
    if (entry.hadRecentInput) continue;
    if (value > 0 && entry.startTime - last < 1_000 && entry.startTime - start < 5_000) {
      value += entry.value;
    } else {
      value = entry.value;
      start = entry.startTime;
    }
    last = entry.startTime;
    maximum = Math.max(maximum, value);
  }
  return maximum;
}
