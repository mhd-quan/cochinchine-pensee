import { parse, serialize } from 'parse5';
export const attr = (node, name) => node?.attrs?.find((a) => a.name === name)?.value;
export const hasClass = (node, name) => (attr(node, 'class') ?? '').split(/\s+/).includes(name);
export function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.childNodes ?? []) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
export function findAll(node, predicate) {
  return [
    ...(predicate(node) ? [node] : []),
    ...(node.childNodes ?? []).flatMap((n) => findAll(n, predicate)),
  ];
}
export function textContent(node) {
  return node?.nodeName === '#text'
    ? node.value
    : (node?.childNodes ?? []).map(textContent).join('');
}
export function readArticle(html) {
  const document = parse(html);
  const article = find(document, (n) => hasClass(n, 'essay'));
  if (!article) throw new Error('Missing article');
  const prose = find(article, (n) => hasClass(n, 'prose'));
  if (!prose) throw new Error('Missing prose');
  const text = (cls) => textContent(find(article, (n) => hasClass(n, cls))).trim();
  return {
    document,
    article,
    prose,
    proseHtml: serialize(prose),
    title: text('essay__title'),
    subtitle: text('essay__subtitle'),
    dek: text('essay__dek'),
    author: text('essay__byline-author'),
    date: attr(
      find(article, (n) => n.tagName === 'time'),
      'datetime',
    ),
    canonical: attr(
      find(document, (n) => n.tagName === 'link' && attr(n, 'rel') === 'canonical'),
      'href',
    ),
    cover: find(
      find(article, (n) => hasClass(n, 'essay__cover')) ?? {},
      (n) => n.tagName === 'img',
    ),
  };
}

export function articleBlocks(node, context = {}) {
  const blocks = [];
  const blockTags = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'blockquote',
    'section',
    'div',
    'figure',
    'figcaption',
    'ul',
    'ol',
    'table',
    'tr',
    'pre',
  ]);
  let runs = [];
  const flush = () => {
    if (runs.some((r) => r.text.trim())) blocks.push({ type: 'text', ...context, runs });
    runs = [];
  };
  const visit = (n, style = {}) => {
    if (n.nodeName === '#text') {
      runs.push({ ...style, text: n.value.replace(/\s+/g, ' ') });
      return;
    }
    if (['script', 'style'].includes(n.tagName)) return;
    // Back-to-reference arrows are browser controls, not prose.
    if (n.tagName === 'a' && /^#fnref/.test(attr(n, 'href') ?? '')) return;
    if (n.tagName === 'br') {
      runs.push({ ...style, text: '\n' });
      return;
    }
    if (n.tagName === 'hr') {
      flush();
      blocks.push({ type: 'rule' });
      return;
    }
    if (n.tagName === 'img') {
      flush();
      blocks.push({ type: 'image', src: attr(n, 'src'), alt: attr(n, 'alt') ?? '' });
      return;
    }
    if (blockTags.has(n.tagName)) {
      flush();
      const next = { ...context, ...style };
      if (/^h[1-6]$/.test(n.tagName)) next.heading = Number(n.tagName.slice(1));
      if (n.tagName === 'blockquote') next.quote = true;
      if (n.tagName === 'figcaption') next.caption = true;
      if (n.tagName === 'li') {
        const parent = n.parentNode;
        const siblings = (parent?.childNodes ?? []).filter((c) => c.tagName === 'li');
        next.marker =
          parent?.tagName === 'ol'
            ? `${Number(attr(parent, 'start') ?? 1) + siblings.indexOf(n)}. `
            : '• ';
      }
      const children = articleBlocks(n, next);
      if (n.tagName === 'li' && children.length) {
        const first = children.find((b) => b.type === 'text');
        if (first) first.runs.unshift({ text: next.marker, generated: true });
      }
      blocks.push(...children);
      return;
    }
    const next = { ...style };
    if (['em', 'i'].includes(n.tagName)) next.italic = true;
    if (['strong', 'b'].includes(n.tagName)) next.bold = true;
    if (n.tagName === 'sup') next.sup = true;
    for (const child of n.childNodes ?? []) visit(child, next);
    if (['td', 'th'].includes(n.tagName)) runs.push({ text: '   ' });
  };
  for (const child of node.childNodes ?? []) visit(child, context);
  flush();
  return blocks;
}
