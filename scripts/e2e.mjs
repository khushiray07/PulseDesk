import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { getTestEnvironment } from '../server/scripts/test-env.mjs';

const require = createRequire(import.meta.url);
const env = getTestEnvironment();
const args = process.argv.slice(2);
if (args.includes('--preview')) env.PULSEDESK_E2E_PREVIEW = 'true';
const run = (file, args, cwd = process.cwd()) => {
  const result = spawnSync(process.execPath, [file, ...args], { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run(require.resolve('prisma/build/index.js'), ['migrate', 'deploy'], 'server');
Object.assign(process.env, env);
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
try { await prisma.ticket.deleteMany(); } finally { await prisma.$disconnect(); }
run('prisma/seed.js', [], 'server');
run(require.resolve('@playwright/test/cli'), ['test', ...args.filter((argument) => argument !== '--preview')]);
