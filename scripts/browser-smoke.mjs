import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PERF_PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.PERF_BASE_URL || 'http://127.0.0.1:4321');
if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use a local preview');

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 663 : 1000 },
      reducedMotion: 'reduce',
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base.href);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('link[as="font"][rel="preload"]').count(), 1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.locator('[data-home-discovery]').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('[data-home-discovery-image] img').count(), 1);
    await page.locator('[data-series-carousel]').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.querySelector('[data-series-carousel]').dataset.ready === 'true',
    );
    await page.locator('[data-series-picker]').selectOption('1');
    await page.waitForFunction(() =>
      document.querySelector('[data-series-position]').textContent.startsWith('2 /'),
    );
    assert.equal(await page.locator('[data-series-slide]:not([inert])').count(), 1);
    await page.locator('[data-series-track]').focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() =>
      document.querySelector('[data-series-position]').textContent.startsWith('1 /'),
    );
    const destination = await page.locator('[data-home-discovery-link]').getAttribute('href');
    await page.locator('[data-home-discovery-link]').click();
    await page.waitForURL(`**${destination}`);
    await page.waitForFunction(() => document.documentElement.dataset.reader === 'true');
    await page.goBack();
    await page.waitForURL(base.href);
    await page.locator('[data-series-carousel]').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.querySelector('[data-series-carousel]').dataset.ready === 'true',
    );
    await page.locator('[data-series-next]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-series-position]').textContent.startsWith('2 /'),
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px: fonts, overflow, SSR, series picker/keyboard, Astro article/back/reinitialize`,
    );
    await context.close();
  }
  const context = await browser.newContext();
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-01-01T12:00:00Z'));
  await page.goto(base.href);
  const fallback = await page.locator('[data-home-discovery]').getAttribute('data-essay-id');
  let requests = 0;
  await page.route('**/discovery/*.json', (route) => {
    requests++;
    return route.fulfill({ status: 503, body: 'Temporarily unavailable' });
  });
  await page.locator('[data-home-discovery]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-home-discovery] img').complete);
  await page.waitForTimeout(200);
  assert.ok(requests > 0);
  assert.equal(await page.locator('[data-home-discovery]').getAttribute('data-essay-id'), fallback);
  await page.unroute('**/discovery/*.json');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(
    () => document.querySelector('[data-home-discovery]').dataset.discoveryDay === '2026-01-01',
  );
  await page.clock.setFixedTime(new Date('2026-01-01T17:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(
    () => document.querySelector('[data-home-discovery]').dataset.discoveryDay === '2026-01-02',
  );
  console.log(
    'PASS discovery: failed HTTP keeps fallback; focus retries; Vietnam midnight rotates',
  );
  await context.close();
} finally {
  await browser.close();
}
