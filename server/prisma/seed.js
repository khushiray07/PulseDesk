import { prisma } from '../src/utils/prisma.js';
import { seedSupportUsers } from './users.seed.js';

const titles = [
  'Payment gateway timeout during checkout',
  'SSO login error after session expires',
  'Unable to update billing credit card',
  'Bulk CSV import stops at row 42',
  'Webhook signature verification failing',
  'Password reset link expires too quickly',
  'Weekly analytics report not delivered',
  'Invoice PDF missing company address',
  'Mobile app notifications arriving twice',
  'Workspace invitation link is invalid',
  'Subscription upgrade charged twice',
  'Account settings page will not load',
  'Order confirmation email missing',
  'Exported spreadsheet has incorrect dates',
  'Two-factor authentication code rejected',
  'Checkout discount code not applying',
  'Dashboard totals differ from report',
  'Customer profile image fails to upload',
  'Refund still pending after seven days',
  'Search results exclude recent orders',
  'Billing contact needs to be updated',
  'API requests returning rate limit errors',
  'Dark mode preference resets on login',
  'Unable to download receipt on mobile',
  'Payment method saved but not selectable',
  'Integration disconnects after reconnecting',
  'Order tracking link leads to a blank page',
  'New team member cannot access workspace',
  'Timezone is incorrect on activity dates',
  'Help center article contains a broken link',
];
const customers = ['marcus.vance', 'elena.rostova', 'david.kim', 'sarah.jenkins', 'dev.team', 'amina.bello', 'tom.bradley', 'nina.patel', 'james.chen', 'olivia.morgan'];
const domains = ['acmecorp.example', 'fintechly.example', 'cloudscale.example', 'healthflow.example', 'startupforge.example'];
const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
const priorities = ['HIGH', 'MEDIUM', 'LOW'];
const now = Date.now();

try {
  await seedSupportUsers(prisma);
  console.log('6 support users are available. Existing user identities and profiles were preserved.');
  await prisma.$transaction(titles.map((title, i) => {
    const id = `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const createdAt = new Date(now - (i * 3 + 1) * 60 * 60 * 1000);
    return prisma.ticket.upsert({
      where: { id },
      update: {},
      create: {
        id, title,
        description: `The customer reported: ${title.toLowerCase()}.\n\nThey have already tried signing out and retrying the action, but the issue continues. Please investigate the affected workflow and confirm the next steps with the customer.`,
        customerEmail: `${customers[i % customers.length]}@${domains[i % domains.length]}`,
        status: statuses[i % 3], priority: priorities[Math.floor(i / 3) % 3],
        createdAt, updatedAt: new Date(createdAt.getTime() + (i % 3) * 20 * 60 * 1000),
      },
    });
  }));
  console.log('30 sample tickets are available. Existing tickets and edits were preserved.');
} finally {
  await prisma.$disconnect();
}
