import { test as base, expect } from '@playwright/test';
import { sessionFixture } from '../../server/tests/helpers/session-fixture.js';
import { prisma } from '../../server/src/utils/prisma.js';

export const test = base.extend({
  page: async ({ page }, use) => {
    const fixture = await sessionFixture();
    await page.context().addCookies([{ name: 'pulsedesk.sid', value: fixture.value, url: 'http://127.0.0.1:5174', httpOnly: true, sameSite: 'Lax' }]);
    await page.context().setExtraHTTPHeaders({ 'X-CSRF-Token': fixture.token });
    await use(page);
  },
});
test.afterAll(async () => { await prisma.$disconnect(); });
export { expect };
