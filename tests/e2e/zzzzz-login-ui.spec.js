import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 320, height: 700 }]) {
  test(`login fits ${viewport.width}px and its primary Google link works from the keyboard`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'PulseDesk', exact: true })).toBeVisible();
    await expect(page.getByText('Support workspace for customer support teams', { exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Workspace highlights' })).toBeVisible();
    await expect(page.locator('.login-card .brand-dot')).toHaveCount(0);
    await expect(page.locator('.login-card input')).toHaveCount(0);
    const google = page.getByRole('link', { name: 'Continue with Google', exact: true });
    await expect(google).toHaveAttribute('href', '/api/auth/google');
    await expect(page.locator('.login-card a')).toHaveCount(1);
    const card = await page.locator('.login-card').boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(16);
    expect(card.x + card.width).toBeLessThanOrEqual(viewport.width - 16);
    expect(Math.abs(card.x + card.width / 2 - viewport.width / 2)).toBeLessThan(1);
    expect((await google.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
    await page.keyboard.press('Tab');
    await expect(google).toBeFocused();
    expect(await google.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
    expect(await google.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(3);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('.header-user')).toContainText('Khushi Ray');
  });
}

test('the login card contains session checking without offering sign-in prematurely', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/auth/me', async (route) => { await pending; await route.continue(); });
  try {
    await page.goto('/login');
    await expect(page.locator('.login-card').getByRole('status', { name: 'Session check' })).toHaveText('Checking your session…');
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveCount(0);
    await expect(page.locator('.app-header')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('checking.png'), fullPage: true });
    release();
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  } finally { release(); }
});

test('the mobile login card accommodates waking and error states with keyboard retry', async ({ page }, testInfo) => {
  test.skip(process.env.PULSEDESK_E2E_PREVIEW !== 'true', 'Waking state is production-only.');
  await page.setViewportSize({ width: 320, height: 700 });
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await page.route('**/api/auth/me', (route) => route.abort());
  await page.goto('/login');
  await expect(page.locator('.login-card').getByRole('status', { name: 'Session check' })).toContainText('Starting PulseDesk…');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('waking.png'), fullPage: true });
  await page.clock.fastForward(75000);
  await expect(page.locator('.login-card').getByRole('alert')).toContainText('We couldn’t reach the server');
  const retry = page.getByRole('button', { name: 'Retry sign-in check' });
  await expect(retry).toBeVisible();
  expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('retry.png'), fullPage: true });
  await page.unroute('**/api/auth/me');
  await retry.focus();
  expect(await retry.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  await retry.press('Enter');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
});
