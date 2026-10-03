import { test, expect } from '@playwright/test';

async function signIn(page) {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('.header-user')).toContainText('Khushi Ray');
}

test('logged-out users see login and protected dashboard/detail routes redirect', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'PulseDesk.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute('href', '/api/auth/google');
  for (const path of ['/dashboard', '/tickets/00000000-0000-4000-8000-000000000000']) {
    await page.goto(path);
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: 'Create ticket' })).toHaveCount(0);
  }
  expect((await page.request.get('/api/tickets')).status()).toBe(401);
});

test('checks the session before rendering protected content', async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let ticketRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/api/tickets')) ticketRequests++; });
  await page.route('**/api/auth/me', async (route) => { await pending; await route.continue(); });
  await page.goto('/dashboard');
  await expect(page.getByRole('status').filter({ hasText: 'Checking your session' })).toHaveText('Checking your session…');
  await expect(page.locator('.app-header')).toHaveCount(0);
  expect(ticketRequests).toBe(0);
  release();
  await expect(page).toHaveURL('/login');
});

test('Google boundary creates a session, shows current user/avatar, and hides the cookie from JavaScript', async ({ page }) => {
  await signIn(page);
  await expect(page.locator('.header-user .user-avatar')).toHaveText('KR');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const me = await page.request.get('/api/auth/me');
  expect((await me.json()).data).toMatchObject({ name: 'Khushi Ray', email: 'khushi.ray@pulsedesk.example' });
  expect(await page.evaluate(() => document.cookie)).not.toContain('pulsedesk.sid');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('refresh preserves authentication and an authenticated login route redirects to dashboard', async ({ page }) => {
  await signIn(page);
  await page.reload();
  await expect(page.locator('.header-user')).toContainText('Khushi Ray');
  await page.goto('/login');
  await expect(page).toHaveURL('/dashboard');
});

test('comments contain only content in the request and belong to the signed-in user', async ({ page }) => {
  await signIn(page);
  const token = (await (await page.request.get('/api/auth/csrf')).json()).data.token;
  const response = await page.request.post('/api/tickets', { headers: { 'X-CSRF-Token': token }, data: { title: 'Signed-in comment authorship', description: 'Authentication test.', customerEmail: 'auth@example.com', priority: 'MEDIUM' } });
  expect(response.status()).toBe(201);
  const ticket = (await response.json()).data;
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByLabel('Comment author')).toHaveCount(0);
  await expect(page.getByText('Commenting as Khushi Ray', { exact: true })).toBeVisible();
  await page.getByLabel('Write a comment').fill('Current agent confirmed the issue.');
  const submission = page.waitForRequest((request) => request.url().endsWith(`/tickets/${ticket.id}/comments`) && request.method() === 'POST');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  expect((await submission).postDataJSON()).toEqual({ content: 'Current agent confirmed the issue.' });
  const comments = page.getByRole('list', { name: 'Ticket comments' });
  await expect(comments).toContainText('Khushi Ray');
  await expect(comments).toContainText('Current agent confirmed');
  await page.reload();
  await expect(comments).toContainText('Khushi Ray');
});

test('logout returns to login and invalidates access to the API', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});

test('an expired browser session returns to login', async ({ page }) => {
  await signIn(page);
  await page.context().clearCookies();
  await page.reload();
  await expect(page).toHaveURL('/login');
});

test('auth-check errors are recoverable without rendering protected content', async ({ page }) => {
  if (process.env.PULSEDESK_E2E_PREVIEW === 'true') {
    const now = new Date();
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 1000));
  }
  await page.route('**/api/auth/me', (route) => route.abort());
  await page.goto('/dashboard');
  if (process.env.PULSEDESK_E2E_PREVIEW === 'true') {
    await expect(page.getByRole('status', { name: 'Session check' })).toContainText('Starting PulseDesk');
    await page.clock.fastForward(75000);
  }
  await expect(page.getByRole('alert')).toContainText('We couldn’t reach the server');
  await expect(page.locator('.app-header')).toHaveCount(0);
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Retry sign-in check' }).click();
  await expect(page).toHaveURL('/login');
});

test('failed OAuth callback shows a safe error and does not sign in', async ({ page }) => {
  await page.goto('/api/auth/google/callback?state=invalid&code=invalid');
  await expect(page).toHaveURL(/\/login\?error=failed$/);
  await expect(page.getByRole('alert')).toHaveText('Sign-in could not be completed. Please try again.');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});
