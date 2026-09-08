export const HOME_QUOTE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const DAY_IN_MS = 86_400_000;
const ROTATION_EPOCH_DAY = Date.UTC(2026, 0, 1) / DAY_IN_MS;
const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HOME_QUOTE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

/** Return the calendar date at the publication in stable YYYY-MM-DD form. */
export function getVietnamDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new TypeError('Invalid date for home discovery');

  const parts = Object.fromEntries(
    vietnamDateFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: part }) => [type, part]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function calendarDayNumber(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new TypeError('Invalid Vietnam calendar date');
  const [, year, month, day] = match;
  const dayNumber = Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_IN_MS;
  const check = new Date(dayNumber * DAY_IN_MS).toISOString().slice(0, 10);
  if (check !== dateKey) throw new TypeError('Invalid Vietnam calendar date');
  return dayNumber;
}

/**
 * Choose the publication-wide quotation for a Vietnam calendar day.
 * Articles advance daily in editorial order. Each complete pass through the
 * articles advances that article to its next curated quote.
 */
export function selectDailyHomeQuote(choices, date = new Date()) {
  if (choices.length === 0) return undefined;

  const byArticle = new Map();
  for (const choice of choices) {
    const articleChoices = byArticle.get(choice.essayId);
    if (articleChoices) articleChoices.push(choice);
    else byArticle.set(choice.essayId, [choice]);
  }

  const dateKey = typeof date === 'string' ? date : getVietnamDateKey(date);
  const rotationDay = calendarDayNumber(dateKey) - ROTATION_EPOCH_DAY;
  const articleIndex = positiveModulo(rotationDay, byArticle.size);
  const passIndex = Math.floor(rotationDay / byArticle.size);
  const articleChoices = [...byArticle.values()][articleIndex];
  return articleChoices[positiveModulo(passIndex, articleChoices.length)];
}

function makePicture(document, image) {
  const picture = document.createElement('picture');
  const source = document.createElement('source');
  source.type = image.avif.type;
  source.srcset = image.avif.srcset;
  source.sizes = image.avif.sizes;

  const img = document.createElement('img');
  img.src = image.fallback.src;
  img.srcset = image.fallback.srcset;
  img.sizes = image.fallback.sizes;
  img.width = image.fallback.width;
  img.height = image.fallback.height;
  img.alt = image.alt;
  img.loading = 'lazy';
  img.decoding = 'async';

  picture.append(source, img);
  return picture;
}

/**
 * Install one persistent lifecycle for direct loads and Astro swaps. The quote
 * remains fixed for its Vietnam calendar day and is reconsidered only on page,
 * history, focus or visibility events that can reveal a date change.
 */
export function createHomeDiscoveryLifecycle({ document, window, now = () => new Date() }) {
  const show = () => {
    const container = document.querySelector('[data-home-discovery]');
    if (!container) return undefined;

    const dayKey = getVietnamDateKey(now());
    if (container.dataset.discoveryReady === 'true' && container.dataset.discoveryDay === dayKey) {
      return undefined;
    }

    const payloadNode = container.querySelector('[data-home-discovery-payload]');
    const active = container.querySelector('[data-home-discovery-active]');
    const link = container.querySelector('[data-home-discovery-link]');
    const quote = container.querySelector('[data-home-discovery-quote]');
    const blockquote = container.querySelector('[data-home-discovery-blockquote]');
    const title = container.querySelector('[data-home-discovery-title]');
    const author = container.querySelector('[data-home-discovery-author]');
    const image = container.querySelector('[data-home-discovery-image]');
    if (!payloadNode || !active || !link || !blockquote || !quote || !title || !author || !image) {
      return undefined;
    }

    let payload;
    try {
      payload = JSON.parse(payloadNode.textContent ?? '{}');
    } catch {
      return undefined;
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray(payload.choices) ||
      payload.choices.length === 0 ||
      !payload.articles ||
      typeof payload.articles !== 'object'
    )
      return undefined;

    const selection = selectDailyHomeQuote(payload.choices, dayKey);
    const article = selection ? payload.articles[selection.essayId] : undefined;
    if (!selection || !article) return undefined;
    const selected = { ...selection, ...article };

    link.href = selected.href;
    link.setAttribute('aria-label', `Read ${selected.title}`);
    blockquote.cite = selected.href;
    quote.textContent = selected.quote;
    quote.lang = selected.lang;
    title.textContent = selected.title;
    title.lang = selected.lang;
    author.textContent = selected.author;
    image.dataset.coverTreatment = selected.coverTreatment;
    image.replaceChildren(makePicture(document, selected.image));
    active.hidden = false;
    container.dataset.discoveryReady = 'true';
    container.dataset.discoveryDay = dayKey;
    container.dataset.essayId = selected.essayId;
    container.dataset.quoteKey = selected.quoteKey;
    return selected;
  };

  document.addEventListener('astro:page-load', show);
  window.addEventListener('pageshow', show);
  window.addEventListener('focus', show);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') show();
  });
  show();

  return { show };
}
