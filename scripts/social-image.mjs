import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

// Reproducible publication artwork; generated once, never in the browser.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#EEEEEB"/>
<path d="M80 80H1120M80 550H1120" stroke="#632D32" stroke-width="3"/>
<g text-anchor="middle" fill="#292522" font-family="EB Garamond">
<text x="600" y="186" font-size="34">The</text>
<text x="600" y="285" font-family="Playfair Display SC" font-size="76">Cochinchine Pensées</text>
<text x="600" y="373" font-size="32">Tiểu luận, pensées và điểm sách</text>
<text x="600" y="496" font-size="25">cochinchinepensees.studio</text>
</g></svg>`;
const image = new Resvg(svg, {
  font: {
    loadSystemFonts: false,
    fontFiles: [
      '../src/assets/fonts/playfair-display-sc/PlayfairDisplaySC-Regular.ttf',
      './assets/pdf-fonts/normal.ttf',
    ].map((path) => fileURLToPath(new URL(path, import.meta.url))),
  },
})
  .render()
  .asPng();
await writeFile(new URL('../public/og-default.png', import.meta.url), image);
