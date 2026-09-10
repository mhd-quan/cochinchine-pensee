import { create } from 'fontkit';

/** Read cmap coverage without dropping variable-font axes or requiring axis names. */
export async function fontCodePoints(buffer) {
  const font = create(buffer);
  return new Set(font.characterSet.filter((point) => font.glyphForCodePoint(point).id !== 0));
}

export function unicodeRange(points) {
  const sorted = [...new Set(points)].sort((a, b) => a - b);
  const spans = [];
  let start = sorted[0];
  let end = start;
  const hex = (point) => point.toString(16).toUpperCase();
  const emit = () => spans.push(start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`);
  for (const point of sorted.slice(1)) {
    if (point === end + 1) end = point;
    else { emit(); start = end = point; }
  }
  if (start !== undefined) emit();
  return spans.join(',');
}
