import supertest from 'supertest';
import { beforeEach, afterAll } from 'vitest';
import { sessionFixture } from './session-fixture.js';
import { seedSupportUsers } from '../../prisma/users.seed.js';
import { prisma } from '../../src/utils/prisma.js';
import { closeSessionStore } from '../../src/auth/session.js';

let fixture;
beforeEach(async () => {
  await seedSupportUsers(prisma);
  await prisma.session.deleteMany();
  fixture = await sessionFixture();
});
afterAll(closeSessionStore);
export default function request(app) {
  const client = supertest(app);
  return Object.fromEntries(['get', 'post', 'patch', 'put', 'delete', 'head'].map((method) => [method,
    (...args) => client[method](...args).set('Connection', 'close').set('Cookie', fixture.cookie).set('X-CSRF-Token', fixture.token),
  ]));
}
