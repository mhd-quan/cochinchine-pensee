import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import opentype from '@shuding/opentype.js';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readArticle, articleBlocks, attr } from './html-document.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.cache/reader-pdf');
const VERSION = 'reader-a4-1';
const PAGE = [595.28, 841.89];
const MARGIN = 64;
const BOTTOM = 66;
const DPI = 216;
const fonts = [];

async function prepareFonts() {
  if (fonts.length) return;
  for (const style of ['normal', 'italic', 'bold', 'bolditalic', 'cjk']) {
    const bytes = await fs.readFile(path.join(root, `scripts/assets/pdf-fonts/${style}.${style === 'cjk' ? 'otf' : 'ttf'}`));
    const parsed = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const points = new Set(Object.entries(parsed.tables.cmap.glyphIndexMap).filter(([, glyph]) => glyph !== 0).map(([point]) => Number(point)));
    fonts.push({ name: style, style, bytes, points });
  }
}

function segments(run, defaultStyle = 'normal') {
  const style = run.bold && run.italic ? 'bolditalic' : run.bold ? 'bold' : run.italic ? 'italic' : defaultStyle;
  const result = [];
  for (const character of run.text.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '')) {
    const point = character.codePointAt(0);
    const font = fonts.find((f) => f.style === style && (f.points.has(point) || character === '\n'))
      ?? fonts.find((f) => f.points.has(point));
    if (!font) throw new Error(`PDF font lacks ${JSON.stringify(character)} U+${point.toString(16)}. Add a licensed fallback; never omit text.`);
    const last = result.at(-1);
    if (last?.font === font.name) last.text += character;
    else result.push({ font: font.name, text: character, sup: run.sup });
  }
  return result;
}

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function localImage(src, dist) {
  if (!src?.startsWith('/images/') && !src?.startsWith('/_astro/')) throw new Error(`PDF requires a generated local image: ${src}`);
  const file = path.resolve(dist, `.${decodeURIComponent(src)}`);
  if (!file.startsWith(`${path.resolve(dist)}${path.sep}`)) throw new Error('Unsafe PDF image path');
  return file;
}

async function typeset(article, dist) {
  const blocks = articleBlocks(article.prose);
  const sourceText = (node) => {
    if (['script', 'style'].includes(node.tagName) || (node.tagName === 'a' && /^#fnref/.test(attr(node, 'href') ?? ''))) return '';
    return node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(sourceText).join('');
  };
  const normalized = (text) => text.normalize('NFC').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
  const extracted = blocks.flatMap((block) => block.runs ?? []).filter((run) => !run.generated).map((run) => run.text).join('');
  if (normalized(extracted) !== normalized(sourceText(article.prose))) throw new Error(`PDF block extraction lost content: ${article.title}`);
  const doc = new PDFDocument({ size: PAGE, margins: { top: 64, bottom: BOTTOM, left: MARGIN, right: MARGIN }, bufferPages: true, autoFirstPage: true });
  const result = collect(doc);
  const expectedText = [];
  for (const font of fonts) doc.registerFont(font.name, font.bytes);
  const width = PAGE[0] - MARGIN * 2;
  function space(height) { if (doc.y + height > PAGE[1] - BOTTOM) doc.addPage(); }
  function text(runs, { size = 13.5, style = 'normal', indent = 0, color = '#181613', heading = false } = {}) {
    const parts = runs.flatMap((r) => segments(r, style));
    if (!parts.length) return;
    parts[0].text = parts[0].text.trimStart();
    parts.at(-1).text = parts.at(-1).text.trimEnd();
    const nonempty = parts.filter((p) => p.text);
    expectedText.push(nonempty.map((p) => p.text).join(''));
    space(heading ? size * 3 + 36 : size * 2 + 8);
    doc.x = MARGIN + indent;
    for (let i = 0; i < nonempty.length; i++) {
      const part = nonempty[i];
      doc.font(part.font).fontSize(part.sup ? size * 0.72 : size).fillColor(color).text(part.text, {
        width: width - indent * 2, lineGap: 4,
        continued: i < nonempty.length - 1,
        ...(part.sup ? { baseline: 'superscript' } : {}),
      });
    }
    doc.x = MARGIN;
    doc.y += heading ? 9 : 8;
  }
  async function image(src, maxHeight) {
    const file = localImage(src, dist);
    const metadata = await sharp(file).metadata();
    const scale = Math.min(width / metadata.width, maxHeight / metadata.height);
    const w = metadata.width * scale, h = metadata.height * scale;
    space(h + 20);
    const y = doc.y;
    doc.image(await sharp(file).png().toBuffer(), MARGIN + (width - w) / 2, y, { width: w, height: h });
    doc.y = y + h + 18;
    doc.x = MARGIN;
  }
  text([{ text: 'THE COCHINCHINE PENSÉES' }], { size: 12, style: 'bold' });
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE[0] - MARGIN, doc.y).lineWidth(0.6).stroke('#8B1A1A');
  doc.y += 24;
  text([{ text: article.title }], { size: 28, style: 'bold', heading: true });
  if (article.subtitle) text([{ text: article.subtitle }], { size: 15, style: 'italic', color: '#4A4038' });
  if (article.dek) text([{ text: article.dek }], { size: 14, style: 'italic' });
  text([{ text: `${article.author} · ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(article.date))}` }], { size: 10.5, color: '#5B5149' });
  if (article.cover) await image(attr(article.cover, 'src'), 180);
  doc.y += 10;
  for (const block of blocks) {
    if (block.type === 'image') await image(block.src, 360);
    else if (block.type === 'rule') {
      space(38); doc.y += 10;
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + 80, doc.y).lineWidth(0.5).stroke('#8B1A1A'); doc.y += 24;
    } else text(block.runs, {
      size: block.heading ? (block.heading <= 2 ? 19 : 16) : block.caption ? 10.5 : 13.5,
      style: block.heading ? 'bold' : block.quote || block.caption ? 'italic' : 'normal',
      indent: block.quote ? 18 : 0, heading: Boolean(block.heading),
    });
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font('normal').fontSize(8).fillColor('#655C54');
    doc.text('cochinchinepensees.studio', MARGIN, PAGE[1] - 40, { lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, PAGE[0] - MARGIN - 32, PAGE[1] - 40, { lineBreak: false });
  }
  doc.end();
  return { bytes: await result, expectedText: expectedText.join('') };
}

async function rasterize({ bytes, expectedText }, title) {
  const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false });
  const source = await loading.promise;
  const pdf = new PDFDocument({ autoFirstPage: false, info: { Title: title, Author: 'The Cochinchine Pensées', Subject: 'Bản đọc và in từ ảnh trang' } });
  const result = collect(pdf);
  try {
    let extracted = '';
    for (let i = 1; i <= source.numPages; i++) {
      const page = await source.getPage(i);
      const content = await page.getTextContent();
      extracted += content.items.filter((item) => item.str && item.transform[5] > BOTTOM - 5).map((item) => item.str).join('');
      const viewport = page.getViewport({ scale: DPI / 72 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const image = await canvas.encode('jpeg', 92);
      pdf.addPage({ size: PAGE, margin: 0 }).image(image, 0, 0, { width: PAGE[0], height: PAGE[1] });
      canvas.width = canvas.height = 1;
      page.cleanup();
    }
    const normalized = (value) => value.normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    if (normalized(extracted) !== normalized(expectedText)) throw new Error(`PDF text fidelity check failed: ${title}`);
    pdf.end();
    return { bytes: await result, pages: source.numPages };
  } finally { await loading.destroy(); }
}

export async function generateReaderPdfs(dist, { only } = {}) {
  await prepareFonts();
  await fs.mkdir(cache, { recursive: true });
  const output = path.join(dist, 'downloads/essays');
  await fs.mkdir(output, { recursive: true });
  const report = [];
  const generatorHash = createHash('sha256').update(await fs.readFile(new URL(import.meta.url)))
    .update(await fs.readFile(new URL('./html-document.mjs', import.meta.url)))
    .update(await fs.readFile(path.join(root, 'package-lock.json'))).digest('hex');
  for (const slug of (await fs.readdir(path.join(dist, 'essays'))).sort()) {
    if (only && slug !== only) continue;
    const html = await fs.readFile(path.join(dist, 'essays', slug, 'index.html'), 'utf8').catch(() => '');
    if (!html.includes('data-reader="true"')) continue;
    const article = readArticle(html);
    const hash = createHash('sha256').update(VERSION).update(generatorHash).update(JSON.stringify({ title: article.title, subtitle: article.subtitle, dek: article.dek, author: article.author, date: article.date, body: article.proseHtml, cover: attr(article.cover, 'src') }));
    for (const font of fonts) hash.update(font.bytes);
    const key = hash.digest('hex');
    const cached = path.join(cache, `${key}.pdf`);
    let entry = JSON.parse(await fs.readFile(path.join(cache, `${key}.json`), 'utf8').catch(() => 'null'));
    if (!entry || !(await fs.stat(cached).catch(() => null))) {
      const vector = await typeset(article, dist);
      const raster = await rasterize(vector, article.title);
      if (raster.bytes.length > 24 * 1024 * 1024) throw new Error(`PDF exceeds static host limit: ${slug}`);
      await fs.writeFile(cached, raster.bytes);
      entry = { slug, pages: raster.pages, bytes: raster.bytes.length, dpi: DPI };
      await fs.writeFile(path.join(cache, `${key}.json`), JSON.stringify(entry));
    }
    await fs.copyFile(cached, path.join(output, `${slug}.pdf`));
    report.push(entry);
  }
  await fs.mkdir(path.join(root, '.astro'), { recursive: true });
  await fs.writeFile(path.join(root, '.astro/reader-pdf-report.json'), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await generateReaderPdfs(path.join(root, 'dist'), { only: process.argv[2] });
  console.log(`Reader PDF: ${report.length} raster-only downloads ready.`);
}
