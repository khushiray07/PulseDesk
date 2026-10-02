import { test, expect } from '@playwright/test';

const khushiId = '50000000-0000-4000-8000-000000000001';
const aishaId = '50000000-0000-4000-8000-000000000002';
async function openTicket(page, title = 'Team collaboration request') {
  const response = await page.request.post('/api/tickets', { data: { title, customerEmail: 'team@example.com', description: 'Details for the support team.', priority: 'MEDIUM' } });
  expect(response.status()).toBe(201);
  const ticket = (await response.json()).data;
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add assignee', exact: true })).toBeEnabled();
  return ticket;
}
async function chooseAssignee(page, name) {
  await page.getByRole('button', { name: 'Add assignee', exact: true }).click();
  await page.getByRole('group', { name: 'Available support users' }).getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('button', { name: `Remove assignee ${name}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add assignee', exact: true })).toBeEnabled();
}

test('adds two assignees, hides assigned users from the chooser, removes one, and persists after refresh', async ({ page }) => {
  const ticket = await openTicket(page);
  await chooseAssignee(page, 'Khushi Ray');
  await chooseAssignee(page, 'Aisha Sharma');
  await page.getByRole('button', { name: 'Add assignee', exact: true }).click();
  const chooser = page.getByRole('group', { name: 'Available support users' });
  await expect(chooser.getByRole('button', { name: /Khushi Ray|Aisha Sharma/ })).toHaveCount(0);
  await expect(chooser.getByRole('button')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(chooser).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Add assignee', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove assignee Khushi Ray' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove assignee Aisha Sharma' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove assignee Khushi Ray' }).click();
  await expect(page.getByRole('button', { name: 'Remove assignee Khushi Ray' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove assignee Aisha Sharma' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove assignee Khushi Ray' })).toHaveCount(0);
  const assignments = (await (await page.request.get(`/api/tickets/${ticket.id}/assignees`)).json()).data;
  expect(assignments.map((assignment) => assignment.userId)).toEqual([aishaId]);
});

test('posts comments with selected authors, timestamps and stable ordering, and persists alongside assignees', async ({ page }) => {
  await openTicket(page, 'Comments and assignees together');
  await chooseAssignee(page, 'Khushi Ray');
  await chooseAssignee(page, 'Aisha Sharma');
  await page.getByLabel('Comment author').selectOption(khushiId);
  await page.getByLabel('Write a comment').fill('Customer confirmed the issue still occurs.');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  const comments = page.getByRole('list', { name: 'Ticket comments' });
  await expect(comments.getByRole('listitem')).toHaveCount(1);
  await expect(comments.getByRole('listitem').first()).toContainText('Khushi Ray');
  await expect(page.getByLabel('Write a comment')).toHaveValue('');
  await page.getByLabel('Comment author').selectOption(aishaId);
  await page.getByLabel('Write a comment').fill('I reproduced this in the latest build.');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(comments.getByRole('listitem')).toHaveCount(2);
  await page.reload();
  await expect(comments.getByRole('listitem')).toHaveCount(2);
  await expect(comments.getByRole('listitem').first()).toContainText('Customer confirmed');
  await expect(comments.getByRole('listitem').nth(1)).toContainText('Aisha Sharma');
  await expect(comments.locator('time').first()).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}T/);
  await expect(page.getByRole('button', { name: 'Remove assignee Khushi Ray' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove assignee Aisha Sharma' })).toBeVisible();
});

test('retains the draft and author after a failed submission, prevents duplicates, and recovers on retry', async ({ page }) => {
  const ticket = await openTicket(page, 'Comment retry request');
  let release;
  let submissions = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route(`**/api/tickets/${ticket.id}/comments`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submissions++;
    await pending; await route.abort();
  });
  await page.getByLabel('Comment author').selectOption(khushiId);
  await page.getByLabel('Write a comment').fill('Keep this investigation update on failure.');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Adding comment…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Write a comment')).toBeDisabled();
  expect(submissions).toBe(1);
  release();
  await expect(page.locator('.comments-card').getByRole('alert')).toContainText('We couldn’t reach the server');
  await expect(page.getByLabel('Write a comment')).toHaveValue('Keep this investigation update on failure.');
  await expect(page.getByLabel('Comment author')).toHaveValue(khushiId);
  await page.unroute(`**/api/tickets/${ticket.id}/comments`);
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Ticket comments' }).getByRole('listitem')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Ticket comments' })).toContainText('Keep this investigation update on failure.');
});

test('rejects missing authors and whitespace-only comments, and renders HTML-looking comments literally', async ({ page }) => {
  await openTicket(page, 'Comment validation request');
  await page.getByLabel('Write a comment').fill('A support update');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.locator('.comments-card').getByRole('alert')).toHaveText('Choose a comment author.');
  await page.getByLabel('Comment author').selectOption(khushiId);
  await page.getByLabel('Write a comment').fill('   ');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.locator('.comments-card').getByRole('alert')).toHaveText('Enter a comment.');
  const content = '<script>window.commentInjection=true</script>\nCustomer log excerpt.';
  await page.getByLabel('Write a comment').fill(content);
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.locator('.comment-content')).toHaveText(content);
  await expect(page.locator('.comment-content script')).toHaveCount(0);
  expect(await page.evaluate(() => window.commentInjection)).toBeUndefined();
});

test('shows recoverable loading/errors for users, assignments and comments without blocking ticket details', async ({ page }) => {
  const response = await page.request.post('/api/tickets', { data: { title: 'Collaboration network recovery', customerEmail: 'team@example.com', description: 'Ticket remains visible.', priority: 'MEDIUM' } });
  const ticket = (await response.json()).data;
  await page.route('**/api/users', (route) => route.abort());
  await page.route(`**/api/tickets/${ticket.id}/assignees`, (route) => route.abort());
  await page.route(`**/api/tickets/${ticket.id}/comments`, (route) => route.abort());
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByRole('heading', { name: ticket.title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add assignee', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add comment', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retry assignees', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry comments', exact: true })).toBeVisible();
  await page.unroute('**/api/users');
  await page.unroute(`**/api/tickets/${ticket.id}/assignees`);
  await page.unroute(`**/api/tickets/${ticket.id}/comments`);
  await page.getByRole('button', { name: 'Retry support users', exact: true }).click();
  await page.getByRole('button', { name: 'Retry assignees', exact: true }).click();
  await page.getByRole('button', { name: 'Retry comments', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add assignee', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Add comment', exact: true })).toBeEnabled();
  await expect(page.getByText('No assignees yet.', { exact: true })).toBeVisible();
  await expect(page.getByText('No comments yet. Share an update with the team.', { exact: true })).toBeVisible();
});

test('retains existing assignees after failed mutations and permits retry', async ({ page }) => {
  const ticket = await openTicket(page, 'Assignee mutation recovery');
  await chooseAssignee(page, 'Khushi Ray');
  await page.route(`**/api/tickets/${ticket.id}/assignees/${khushiId}`, (route) => route.abort());
  await page.getByRole('button', { name: 'Remove assignee Khushi Ray' }).click();
  await expect(page.locator('.assignees-card').getByRole('alert')).toContainText('We couldn’t reach the server');
  await expect(page.getByRole('button', { name: 'Remove assignee Khushi Ray' })).toBeVisible();
  await page.unroute(`**/api/tickets/${ticket.id}/assignees/${khushiId}`);
  await page.getByRole('button', { name: 'Remove assignee Khushi Ray' }).click();
  await expect(page.getByText('No assignees yet.', { exact: true })).toBeVisible();
});

test('keeps collaboration usable on mobile and persists comments and multiple assignees', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTicket(page, 'Mobile team collaboration');
  await chooseAssignee(page, 'Khushi Ray');
  await chooseAssignee(page, 'Aisha Sharma');
  await page.getByLabel('Comment author').selectOption(khushiId);
  await page.getByLabel('Write a comment').fill('Mobile customer update with a long reference: ' + 'a'.repeat(120));
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Ticket comments' })).toContainText('Mobile customer update');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove assignee Khushi Ray' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove assignee Aisha Sharma' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Ticket comments' })).toContainText('Mobile customer update');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
