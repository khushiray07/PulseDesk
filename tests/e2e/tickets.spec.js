import { test, expect } from './fixtures.js';

const summaryValues = (page) => page.locator('.metric-value');

test('dashboard combines filters/search and preserves global summary', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Ticket dashboard' })).toBeVisible();
  await expect(summaryValues(page).first()).toHaveText('30');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByLabel('Filter by status').selectOption('OPEN');
  await page.getByLabel('Filter by priority').selectOption('HIGH');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(summaryValues(page).first()).toHaveText('30');
  await page.getByRole('textbox', { name: 'Search tickets' }).fill('PAYMENT');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Payment gateway');
  await expect(page).toHaveURL(/search=PAYMENT/);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Search tickets' })).toHaveValue('PAYMENT');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
});

test('sorts, paginates, searches email and restores queue when returning from details', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByLabel('Sort by creation date').selectOption('oldest');
  await expect(page.locator('tbody tr').first()).toContainText('Help center article');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.locator('tbody .ticket-title').first().click();
  await expect(page.getByRole('heading', { name: 'Issue description' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to ticket queue' }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole('textbox', { name: 'Search tickets' }).fill('marcus.vance@acmecorp.example');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page).not.toHaveURL(/page=2/);
});

test('modal validates, creates and persists a ticket; detail updates persist after refresh', async ({ page }) => {
  await page.goto('/dashboard');
  const baseline = (await (await page.request.get('/api/tickets/summary')).json()).data;
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.field-error')).toHaveCount(0);
  await modal.getByLabel('Ticket title').fill('E2E customer checkout request');
  await modal.getByLabel('Customer email').fill('invalid');
  await modal.getByLabel('Description').fill('Checkout remains unavailable after retrying.');
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(modal.getByText('Enter a valid customer email address.')).toBeVisible();
  await modal.getByLabel('Customer email').fill('e2e@example.com');
  await modal.getByLabel('Priority').selectOption('HIGH');
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { name: 'E2E customer checkout request' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('OPEN');
  await page.getByLabel('Status', { exact: true }).selectOption('RESOLVED');
  await page.getByLabel('Priority', { exact: true }).selectOption('LOW');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Ticket changes saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('RESOLVED');
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('LOW');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await page.getByRole('link', { name: 'Back to ticket queue' }).click();
  await expect(summaryValues(page).first()).toHaveText(String(baseline.total + 1));
  await expect(summaryValues(page).nth(3)).toContainText(String(baseline.resolved + 1));
});

test('modal supports Escape and returns focus to the opener', async ({ page }) => {
  await page.goto('/dashboard');
  const opener = page.getByRole('button', { name: 'Create ticket', exact: true });
  await opener.click();
  await expect(page.getByLabel('Ticket title')).toBeFocused();
  await expect(page.locator('.field-error')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('no matches offers filter reset', async ({ page }) => {
  await page.goto('/dashboard?search=unfindable-ticket-xyz');
  await expect(page.getByRole('heading', { name: 'No tickets match your search' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
});

test('empty dataset offers ticket creation', async ({ page }) => {
  await page.route('**/api/tickets?*', (route) => route.fulfill({ json: { success: true, data: { tickets: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } } } }));
  await page.route('**/api/tickets/summary', (route) => route.fulfill({ json: { success: true, data: { total: 0, open: 0, inProgress: 0, resolved: 0 } } }));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'A fresh start for your support queue' })).toBeVisible();
  await page.getByRole('button', { name: 'Create your first ticket' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('list network failure offers retry and recovers', async ({ page }) => {
  await page.route('**/api/tickets?*', (route) => route.abort());
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Something interrupted the connection' })).toBeVisible();
  await page.unroute('**/api/tickets?*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
});

test('summary failure does not block the list', async ({ page }) => {
  const total = (await (await page.request.get('/api/tickets/summary')).json()).data.total;
  await page.route('**/api/tickets/summary', (route) => route.abort());
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Summary is unavailable' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.unroute('**/api/tickets/summary');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(summaryValues(page).first()).toHaveText(String(total));
});

test('shows ticket loading skeleton and handles missing details', async ({ page }) => {
  let finish;
  await page.route('**/api/tickets?*', async (route) => {
    await new Promise((resolve) => { finish = resolve; });
    await route.continue();
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('status', { name: 'Loading tickets' })).toBeVisible();
  finish();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.goto('/tickets/30000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { name: 'Ticket not found' })).toBeVisible();
});

test('mobile queue, filters and details fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(page.locator('.ticket-mobile-card')).toHaveCount(10);
  await expect(page.locator('.desktop-tickets')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel('Filter by priority').selectOption('HIGH');
  await page.locator('.mobile-tickets .ticket-title').first().click();
  await expect(page.getByRole('heading', { name: 'Ticket properties' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('failed creation retains input, prevents duplicate submission and recovers on retry', async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/tickets', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await pending;
    await route.abort();
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Ticket title').fill('Creation retry customer request');
  await modal.getByLabel('Customer email').fill('retry@example.com');
  await modal.getByLabel('Description').fill('Keep these details when the server cannot be reached.');
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  release();
  await expect(modal.getByRole('alert')).toContainText('We couldn’t reach the server');
  await expect(modal.getByLabel('Ticket title')).toHaveValue('Creation retry customer request');
  await expect(modal.getByLabel('Customer email')).toHaveValue('retry@example.com');
  await expect(modal.getByLabel('Description')).toHaveText('Keep these details when the server cannot be reached.');
  await page.unroute('**/api/tickets');
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Creation retry customer request' })).toBeVisible();
});

test('failed update retains edits and saves successfully on retry', async ({ page }) => {
  const id = '10000000-0000-4000-8000-000000000001';
  await page.goto(`/tickets/${id}`);
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('OPEN');
  await page.getByLabel('Status', { exact: true }).selectOption('IN_PROGRESS');
  await page.getByLabel('Priority', { exact: true }).selectOption('LOW');
  await page.route(`**/api/tickets/${id}`, (route) => route.request().method() === 'PATCH' ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('We couldn’t reach the server');
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('IN_PROGRESS');
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('LOW');
  const persisted = (await (await page.request.get(`/api/tickets/${id}`)).json()).data;
  expect(persisted.status).toBe('OPEN');
  expect(persisted.priority).toBe('HIGH');
  await page.unroute(`**/api/tickets/${id}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Ticket changes saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('IN_PROGRESS');
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('LOW');
});

test('an older search response cannot replace newer search results', async ({ page }) => {
  let release;
  let intercepted;
  let completed;
  const held = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { intercepted = resolve; });
  const finished = new Promise((resolve) => { completed = resolve; });
  await page.route('**/api/tickets?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('search') !== 'Payment') return route.continue();
    const response = await route.fetch();
    intercepted();
    await held;
    try { await route.fulfill({ response }); } finally { completed(); }
  });
  await page.goto('/dashboard');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  const search = page.getByRole('textbox', { name: 'Search tickets' });
  await search.fill('Payment');
  await started;
  await search.fill('Webhook');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Webhook signature');
  release();
  await finished;
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Webhook signature');
  await expect(search).toHaveValue('Webhook');
});

test('fuzzy title search works with filters, date sorting and the existing dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  const total = (await (await page.request.get('/api/tickets/summary')).json()).data.total;
  await page.getByRole('textbox', { name: 'Search tickets' }).fill('pasword');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Password reset link');
  await page.getByLabel('Filter by status').selectOption('RESOLVED');
  await page.getByLabel('Filter by priority').selectOption('MEDIUM');
  await page.getByLabel('Sort by creation date').selectOption('oldest');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Password reset link');
  await expect(summaryValues(page).first()).toHaveText(String(total));
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('textbox', { name: 'Search tickets' }).fill('paymnt');
  await expect(page).toHaveURL(/search=paymnt/);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody .ticket-title').filter({ hasText: 'Payment gateway' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Search tickets' })).toHaveValue('paymnt');
  await expect(page.locator('tbody .ticket-title').filter({ hasText: 'Payment gateway' })).toBeVisible();
});
