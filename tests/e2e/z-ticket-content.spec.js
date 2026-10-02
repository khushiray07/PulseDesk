import { test, expect } from './fixtures.js';

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const image = (name = 'screenshot.png') => ({ name, mimeType: 'image/png', buffer: Buffer.from(pngBase64, 'base64') });
const document = { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF') };
async function openCreate(page, title) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Ticket title').fill(title);
  await modal.getByLabel('Customer email').fill('content@example.com');
  await modal.getByLabel('Priority').selectOption('HIGH');
  return modal;
}
async function createViaApi(page, title = 'Supporting files request') {
  const response = await page.request.post('/api/tickets', { data: { title, customerEmail: 'files@example.com', description: 'Existing plain-text details.\nPlease investigate.', priority: 'MEDIUM' } });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

test('creates rich text plus multiple attachments and preserves them, edits, and fuzzy search after refresh', async ({ page }) => {
  const modal = await openCreate(page, 'Password attachment integration request');
  const editor = modal.getByRole('textbox', { name: 'Description', exact: true });
  await editor.fill('Customer sees a login error.');
  await editor.press('ControlOrMeta+A');
  await modal.getByRole('button', { name: 'Bold', exact: true }).click();
  await modal.getByRole('button', { name: 'Link', exact: true }).click();
  await modal.getByLabel('Link URL').fill('https://example.com/help');
  await modal.getByRole('button', { name: 'Apply', exact: true }).click();
  await modal.getByLabel('Choose attachments').setInputFiles([image(), document]);
  await expect(modal.getByRole('list', { name: 'Selected attachments' }).getByRole('listitem')).toHaveCount(2);
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+/);
  await expect(page.locator('.description-body strong')).toHaveText('Customer sees a login error.');
  await expect(page.getByRole('list', { name: 'Ticket attachments' }).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('img', { name: 'screenshot.png' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.description-body strong')).toHaveText('Customer sees a login error.');
  await expect(page.locator('.description-body a')).toHaveAttribute('href', 'https://example.com/help');
  await expect(page.locator('.description-body a')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByRole('link', { name: 'Download invoice.pdf' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').pop();
  const query = await page.request.get('/api/tickets?search=pasword&status=OPEN&priority=HIGH&sort=oldest');
  const matches = (await query.json()).data;
  expect(matches.tickets.some((ticket) => ticket.id === id)).toBe(true);
  expect(matches.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  await page.getByRole('button', { name: 'Edit description' }).click();
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Updated reproduction steps');
  await page.getByRole('textbox', { name: 'Description', exact: true }).press('ControlOrMeta+A');
  await page.getByRole('button', { name: 'Numbered list' }).click();
  await page.getByRole('button', { name: 'Save description', exact: true }).click();
  await expect(page.locator('.description-body ol li')).toContainText('Updated reproduction steps');
  await page.reload();
  await expect(page.locator('.description-body ol li')).toContainText('Updated reproduction steps');
  await expect(page.getByRole('list', { name: 'Ticket attachments' }).getByRole('listitem')).toHaveCount(2);
});

test('routes dropped files and pasted screenshots to attachments while safely preserving pasted text formatting', async ({ page }) => {
  const modal = await openCreate(page, 'Clipboard and drop request');
  const editor = modal.getByRole('textbox', { name: 'Description', exact: true });
  await editor.focus();
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData('text/html', '<p><em>Pasted issue details</em><script>window.pasteInjection=true</script><img src="data:image/png;base64,AAA"></p>');
    data.setData('text/plain', 'Pasted issue details');
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(editor.locator('em')).toHaveText('Pasted issue details');
  await expect(editor.locator('img, script')).toHaveCount(0);
  await editor.evaluate((element, base64) => {
    const data = new DataTransfer();
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    data.items.add(new File([bytes], 'clipboard.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }, pngBase64);
  const drop = modal.getByRole('button', { name: 'Browse, drop, or paste attachments' });
  await drop.evaluate((element, base64) => {
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], 'dropped.png', { type: 'image/png' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  }, pngBase64);
  await expect(modal.getByRole('list', { name: 'Selected attachments' }).getByRole('listitem')).toHaveCount(2);
  await expect(editor.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.pasteInjection)).toBeUndefined();
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clipboard and drop request' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.description-body em')).toHaveText('Pasted issue details');
  await expect(page.getByRole('list', { name: 'Ticket attachments' }).getByRole('listitem')).toHaveCount(2);
});

test('retains a saved ticket after upload failure and retries files without duplicate ticket creation', async ({ page }) => {
  const baseline = (await (await page.request.get('/api/tickets/summary')).json()).data.total;
  const modal = await openCreate(page, 'Partial upload retry request');
  await modal.getByRole('textbox', { name: 'Description', exact: true }).fill('Ticket creation must survive a file failure.');
  await modal.getByLabel('Choose attachments').setInputFiles(image('retry.png'));
  await page.route('**/api/tickets/*/attachments', (route) => route.request().method() === 'POST' ? route.fulfill({ status: 503, json: { success: false, error: { code: 'UNAVAILABLE', message: 'Upload interrupted. Try again.' } } }) : route.continue());
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(modal.getByRole('alert').filter({ hasText: 'The ticket was created.' })).toBeVisible();
  await expect(modal.getByRole('alert').filter({ hasText: 'Upload interrupted.' })).toBeVisible();
  expect((await (await page.request.get('/api/tickets/summary')).json()).data.total).toBe(baseline + 1);
  await expect(modal.getByLabel('Ticket title')).toBeDisabled();
  await page.unroute('**/api/tickets/*/attachments');
  await modal.getByRole('button', { name: 'Retry / continue' }).click();
  await expect(page.getByRole('heading', { name: 'Partial upload retry request' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download retry.png' })).toBeVisible();
  expect((await (await page.request.get('/api/tickets/summary')).json()).data.total).toBe(baseline + 1);
});

test('validates empty rich text and invalid files, and allows removing queued files', async ({ page }) => {
  const modal = await openCreate(page, 'Content validation request');
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(modal.getByText('Enter a description.', { exact: true })).toBeVisible();
  await modal.getByLabel('Choose attachments').setInputFiles([
    { name: 'program.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') },
    { name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]);
  await expect(modal.getByText('Use PNG, JPEG, WEBP, PDF, or TXT.', { exact: true })).toBeVisible();
  await expect(modal.getByText('Each file must be 5 MiB or smaller.', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Remove program.exe' }).click();
  await modal.getByRole('button', { name: 'Remove huge.png' }).click();
  await expect(modal.getByRole('list', { name: 'Selected attachments' })).toHaveCount(0);
});

test('uploads and deletes attachments on an existing ticket and persists deletion after reload', async ({ page }) => {
  const ticket = await createViaApi(page);
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByText('No attachments yet.')).toBeVisible();
  await page.getByLabel('Choose attachments').setInputFiles(image('detail.png'));
  await page.getByRole('button', { name: 'Upload attachments', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download detail.png' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Download detail.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete detail.png' }).click();
  await expect(page.getByText('No attachments yet.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No attachments yet.')).toBeVisible();
});

test('renders legacy plain-text descriptions and their newlines without HTML interpretation', async ({ page }) => {
  const ticket = await createViaApi(page, 'Legacy description request');
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.locator('.description-body')).toHaveText('Existing plain-text details.\nPlease investigate.');
  await page.getByRole('button', { name: 'Edit description' }).click();
  await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toContainText('Existing plain-text details.');
  await page.getByRole('button', { name: 'Cancel editing' }).click();
  await expect(page.locator('.description-body')).toContainText('Please investigate.');
});

test('sanitizes unsafe HTML again before rendering and renders safe links with protected attributes', async ({ page }) => {
  const ticket = await createViaApi(page, 'Render sanitization request');
  await page.route(`**/api/tickets/${ticket.id}`, (route) => route.fulfill({ json: { success: true, data: { ...ticket, description: '<p onclick="window.renderInjection=true">Safe <a href="https://example.com/help">Help</a><a href="javascript:window.renderInjection=true">Unsafe</a></p><script>window.renderInjection=true</script><img src="x" onerror="window.renderInjection=true"><iframe src="about:blank"></iframe>' } } }));
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.locator('.description-body')).toContainText('Safe');
  await expect(page.locator('.description-body script, .description-body img, .description-body iframe, .description-body [onclick]')).toHaveCount(0);
  const safe = page.locator('.description-body').getByRole('link', { name: 'Help' });
  await expect(safe).toHaveAttribute('href', 'https://example.com/help');
  await expect(safe).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await page.locator('.description-body a').nth(1).getAttribute('href')).toBeNull();
  expect(await page.evaluate(() => window.renderInjection)).toBeUndefined();
});

test('keeps new editors and attachment controls within a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const modal = await openCreate(page, 'Mobile content request');
  await modal.getByRole('textbox', { name: 'Description', exact: true }).fill('Mobile reproduction steps.');
  await modal.getByLabel('Choose attachments').setInputFiles(image('mobile.png'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await modal.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download mobile.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit description' }).click();
  await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('accepts JPEG and WEBP images based on their contents and renders their stored previews', async ({ page }) => {
  const ticket = await createViaApi(page, 'JPEG and WEBP screenshot request');
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByText('No attachments yet.')).toBeVisible();
  const generated = await page.evaluate(() => {
    const canvas = window.document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    canvas.getContext('2d').fillRect(0, 0, 1, 1);
    return ['image/jpeg', 'image/webp'].map((type) => canvas.toDataURL(type).split(',')[1]);
  });
  await page.getByLabel('Choose attachments').setInputFiles([
    { name: 'screenshot.jpg', mimeType: 'application/octet-stream', buffer: Buffer.from(generated[0], 'base64') },
    { name: 'screenshot.webp', mimeType: 'application/octet-stream', buffer: Buffer.from(generated[1], 'base64') },
  ]);
  await page.getByRole('button', { name: 'Upload attachments', exact: true }).click();
  for (const name of ['screenshot.jpg', 'screenshot.webp']) {
    const preview = page.getByRole('img', { name });
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate((element) => element.naturalWidth)).toBe(1);
  }
  const list = (await (await page.request.get(`/api/tickets/${ticket.id}/attachments`)).json()).data;
  expect(list.map((attachment) => attachment.mimeType).sort()).toEqual(['image/jpeg', 'image/webp']);
});
