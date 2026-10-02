import 'dotenv/config';
import { assertTestDatabase } from './helpers/session-fixture.js';
import { createApp } from '../src/app.js';
import { authConfig } from '../src/auth/config.js';
import { supportUsers } from '../prisma/users.seed.js';
import { prisma } from '../src/utils/prisma.js';
import { closeSessionStore } from '../src/auth/session.js';

assertTestDatabase();
const provider = {
  async authorization(transaction) {
    const url = new URL(authConfig.callback);
    url.searchParams.set('state', transaction.state); url.searchParams.set('code', 'browser-test-code');
    return url.href;
  },
  async identity(url) {
    if (url.searchParams.get('code') !== 'browser-test-code') throw new Error('Invalid mock code');
    return { sub: 'browser-test-agent', email: supportUsers[0].email, email_verified: true, name: supportUsers[0].name };
  },
};
const server = createApp({ provider }).listen(Number(process.env.PORT), '127.0.0.1');
async function shutdown() { server.close(async () => { await closeSessionStore(); await prisma.$disconnect(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
