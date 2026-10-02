import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { getTestEnvironment } from './test-env.mjs';

const require = createRequire(import.meta.url);
const env = getTestEnvironment();
const run = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run(require.resolve('prisma/build/index.js'), ['migrate', 'deploy']);
run(join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), ['run']);
