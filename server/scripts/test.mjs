import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { getTestEnvironment } from './test-env.mjs';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);
const env = getTestEnvironment();
const run = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Test command failed with exit code ${result.status || 1}.`);
};
try {
  run(require.resolve('prisma/build/index.js'), ['migrate', 'deploy']);
  run(join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), ['run']);
} finally { rmSync(env.ATTACHMENT_STORAGE_DIR, { recursive: true, force: true }); }
