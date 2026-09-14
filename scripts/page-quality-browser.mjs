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
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const routes = [
    '/',
    '/essays',
    '/archives',
    '/books',
    '/authors',
    '/series',
    '/search',
    '/subscribe',
    '/about',
    '/privacy',
    '/essays/2026-01-19-thien-menh-o',
    '/missing-v091',
  ];
  for (const width of [320, 390, 568, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 568 ? 320 : width < 768 ? 663 : 1000 });
    for (const route of routes) {
      const response = await page.goto(new URL(route, base).href);
      assert.equal(response.status(), route === '/missing-v091' ? 404 : 200, route);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width}px: ${route}`,
      );
      if (route === '/') {
        const cta = await page.locator('[data-newsletter-banner]').boundingBox();
        assert.ok(
          cta && cta.y >= 0 && cta.y + cta.height <= page.viewportSize().height,
          `${width}px: CTA above fold`,
        );
      }
    }
  }
  console.log(
    'PASS 72 page/viewport combinations: HTTP status, horizontal overflow, first-screen CTA',
  );
  await page.setViewportSize({ width: 390, height: 663 });
  await page.goto(base.href);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('href'), '#main');
  const toggle = page.locator('[data-menu-toggle]').first();
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await page.goto(new URL('/privacy', base).href);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  console.log('PASS skip link, mobile menu/Escape, Privacy at 200% text size');

  // Block a real index download; the user must see a recoverable error, not an empty result.
  let releaseIndex;
  const indexBlocked = new Promise((resolve) => {
    releaseIndex = resolve;
  });
  await page.route('**/pagefind/pagefind.js', async (route) => {
    await indexBlocked;
    return route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.goto(new URL('/search?q=tự%20do', base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('.search-status').textContent === 'Đang tìm…',
  );
  assert.equal(await page.locator('publication-search').getAttribute('aria-busy'), 'true');
  releaseIndex();
  await page.waitForFunction(() =>
    document.querySelector('.search-status').textContent.includes('Chưa tải được'),
  );
  await page.unroute('**/pagefind/pagefind.js');
  const search = page.locator('publication-search');
  await search.locator('form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('.search-results li') !== null);
  assert.equal(await search.getAttribute('aria-busy'), null);
  const input = search.locator('input');
  await input.fill('zzzzv091khongcoketqua');
  await page.waitForFunction(() =>
    document.querySelector('.search-status').textContent.includes('Không tìm thấy'),
  );
  await input.fill('');
  await page.waitForFunction(() => document.querySelector('.search-status').textContent === '');
  assert.equal(await search.locator('li').count(), 0);
  console.log('PASS search: loading, failed index, retry, results, empty result, cleared query');
  assert.deepEqual(errors, []);
  await context.close();

  const noScript = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 663 },
  });
  const fallback = await noScript.newPage();
  await fallback.goto(new URL('/search', base).href);
  assert.ok(await fallback.locator('noscript a[href="/archives"]').isVisible());
  await fallback.goto(new URL('/essays/2026-01-19-thien-menh-o', base).href);
  assert.ok(await fallback.locator('.prose').isVisible());
  console.log('PASS JavaScript disabled: article remains readable, search links to archive');
  await noScript.close();
} finally {
  await browser.close();
}
