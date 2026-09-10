import fontverter from 'fontverter';
import opentype from '@shuding/opentype.js';

export async function fontCodePoints(buffer) {
  const ttf = await fontverter.convert(buffer, 'truetype');
  const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
  return new Set(Object.entries(font.tables.cmap.glyphIndexMap)
    .filter(([, glyph]) => glyph !== 0)
    .map(([point]) => Number(point)));
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
