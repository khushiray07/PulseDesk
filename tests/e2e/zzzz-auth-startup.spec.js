import { test, expect } from '@playwright/test';

test.skip(process.env.PULSEDESK_E2E_PREVIEW !== 'true', 'Cold-start retries apply only to the production frontend.');

async function pauseClock(page) {
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
}

for (const failure of ['network', 502, 503, 504]) {
  test(`production session recovers from ${failure} without exposing protected content early`, async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Continue with Google' }).click();
    await expect(page.locator('.header-user')).toContainText('Khushi Ray');
    await pauseClock(page);
    let checks = 0;
    let ticketRequests = 0;
    page.on('request', (request) => { if (request.url().includes('/api/tickets')) ticketRequests++; });
    await page.route('**/api/auth/me', (route) => {
      checks++;
      if (checks > 1) return route.continue();
      return failure === 'network' ? route.abort() : route.fulfill({ status: failure, body: 'Temporarily unavailable' });
    });
    await page.reload();
    await expect(page.getByRole('status', { name: 'Session check' })).toContainText('Starting PulseDesk…');
    await expect(page.getByRole('status', { name: 'Session check' })).toContainText('The demo server is waking up. This may take up to a minute on free hosting.');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.app-header')).toHaveCount(0);
    expect(ticketRequests).toBe(0);
    await page.clock.runFor(3999);
    expect(checks).toBe(1);
    await page.clock.runFor(1);
    await expect(page.locator('.header-user')).toContainText('Khushi Ray');
    expect(checks).toBe(2);
    await page.clock.runFor(75000);
    expect(checks).toBe(2);
  });
}

test('a slow production session check keeps one request in flight and starts friendly loading after five seconds', async ({ page }) => {
  await pauseClock(page);
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let checks = 0;
  let ticketRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/api/tickets')) ticketRequests++; });
  await page.route('**/api/auth/me', async (route) => { checks++; await pending; await route.continue(); });
  try {
    await page.goto('/dashboard');
    await expect(page.getByRole('status', { name: 'Session check' })).toHaveText('Checking your session…');
    await page.clock.runFor(4999);
    await expect(page.getByRole('status', { name: 'Session check' })).toHaveText('Checking your session…');
    await page.clock.runFor(1);
    await expect(page.getByRole('status', { name: 'Session check' })).toContainText('Starting PulseDesk…');
    await page.clock.runFor(4000);
    expect(checks).toBe(1);
    expect(ticketRequests).toBe(0);
    await expect(page.locator('.app-header')).toHaveCount(0);
    release();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  } finally { release(); }
});

test('permanent network failure ends the retry window and allows a keyboard retry', async ({ page }) => {
  await pauseClock(page);
  let checks = 0;
  await page.route('**/api/auth/me', (route) => { checks++; return route.abort(); });
  await page.goto('/dashboard');
  await expect(page.getByRole('status', { name: 'Session check' })).toContainText('Starting PulseDesk…');
  await page.clock.runFor(4000);
  await expect.poll(() => checks).toBe(2);
  await page.clock.fastForward(71000);
  await expect(page.getByRole('alert')).toContainText('We couldn’t reach the server');
  await expect(page.locator('.app-header')).toHaveCount(0);
  const finalChecks = checks;
  expect(finalChecks).toBeLessThanOrEqual(19);
  await page.clock.runFor(120000);
  expect(checks).toBe(finalChecks);
  await page.unroute('**/api/auth/me');
  const retry = page.getByRole('button', { name: 'Retry sign-in check' });
  await retry.focus();
  await retry.press('Enter');
  await expect(page).toHaveURL('/login');
});

test('the startup deadline cancels a session request that never responds', async ({ page }) => {
  await pauseClock(page);
  let checks = 0;
  await page.route('**/api/auth/me', () => { checks++; });
  await page.goto('/dashboard');
  await expect(page.getByRole('status', { name: 'Session check' })).toHaveText('Checking your session…');
  await page.clock.runFor(5000);
  await expect(page.getByRole('status', { name: 'Session check' })).toContainText('Starting PulseDesk…');
  const cancelled = page.waitForEvent('requestfailed', (request) => request.url().endsWith('/api/auth/me'));
  await page.clock.fastForward(70000);
  await cancelled;
  await expect(page.getByRole('alert')).toContainText('We couldn’t reach the server');
  await expect(page.getByRole('button', { name: 'Retry sign-in check' })).toBeVisible();
  await page.clock.runFor(120000);
  expect(checks).toBe(1);
  await expect(page.locator('.app-header')).toHaveCount(0);
});

test('401 ends production startup immediately and never retries', async ({ page }) => {
  await pauseClock(page);
  let checks = 0;
  let ticketRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/api/tickets')) ticketRequests++; });
  await page.route('**/api/auth/me', (route) => {
    checks++;
    return route.fulfill({ status: 401, json: { success: false, error: { code: 'UNAUTHENTICATED' } } });
  });
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await page.clock.runFor(75000);
  expect(checks).toBe(1);
  expect(ticketRequests).toBe(0);
  await expect(page.locator('.app-header')).toHaveCount(0);
});

for (const status of [400, 403, 500]) {
  test(`production does not retry a definitive ${status} response`, async ({ page }) => {
    await pauseClock(page);
    let checks = 0;
    await page.route('**/api/auth/me', (route) => { checks++; return route.fulfill({ status, body: 'Request failed' }); });
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Retry sign-in check' })).toBeVisible();
    await page.clock.runFor(75000);
    expect(checks).toBe(1);
    await expect(page.locator('.app-header')).toHaveCount(0);
  });
}

test('session invalidation cancels scheduled production retries', async ({ page }) => {
  await pauseClock(page);
  let checks = 0;
  await page.route('**/api/auth/me', (route) => { checks++; return route.abort(); });
  await page.goto('/dashboard');
  await expect(page.getByRole('status', { name: 'Session check' })).toContainText('Starting PulseDesk…');
  await page.evaluate(() => window.dispatchEvent(new Event('pulsedesk:unauthorized')));
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await page.clock.runFor(120000);
  expect(checks).toBe(1);
  await expect(page.locator('.app-header')).toHaveCount(0);
});
