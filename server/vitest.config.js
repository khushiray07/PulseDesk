import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.js'], fileParallelism: false, testTimeout: 10000, hookTimeout: 20000 },
});
