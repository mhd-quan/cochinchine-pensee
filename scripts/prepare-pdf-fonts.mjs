import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subset from 'subset-font';

// Maintenance only; production builds use the committed, licensed font files.
const [regular, italic, cjk] = process.argv.slice(2);
if (!regular || !italic || !cjk) throw new Error('Usage: node scripts/prepare-pdf-fonts.mjs regular-variable.ttf italic-variable.ttf NotoSerifCJKsc-Regular.otf');
const root = fileURLToPath(new URL('../', import.meta.url));
let repertoire = '';
for (const file of await fs.readdir(path.join(root, 'src/content/essays'))) {
  if (file.endsWith('.mdx')) repertoire += await fs.readFile(path.join(root, 'src/content/essays', file), 'utf8');
}
// Keep the full usual Latin/Greek/Cyrillic repertoire for subsequent essays.
for (let point = 32; point < 0x3000; point++) repertoire += String.fromCodePoint(point);
for (const [name, source, wght] of [['normal', regular, 400], ['bold', regular, 600], ['italic', italic, 400], ['bolditalic', italic, 600]]) {
  const bytes = await subset(await fs.readFile(source), repertoire, { targetFormat: 'sfnt', variationAxes: { wght } });
  await fs.writeFile(path.join(root, `scripts/assets/pdf-fonts/${name}.ttf`), bytes);
}
await fs.writeFile(path.join(root, 'scripts/assets/pdf-fonts/cjk.otf'), await subset(await fs.readFile(cjk), repertoire, { targetFormat: 'sfnt' }));
console.log('PDF fonts prepared. Keep upstream licenses and visually verify a new PDF.');
